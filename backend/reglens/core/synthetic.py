"""Reproducible synthetic banking data with PLANTED compliance scenarios.

Normal traffic is deliberately shaped so that it fires no rule; every planted transaction carries
hand-labelled expected rules and obligations, written to ground_truth.csv for evaluation.
"""

from __future__ import annotations

import csv
import os
import random
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path

SEED = 2026
END_DATE = date.fromisoformat(os.environ.get("SYNTH_END_DATE", "2026-10-18"))
START_DATE = END_DATE - timedelta(days=92)
USD_INR = 88.0

FIRST = ["Aarav", "Diya", "Kabir", "Isha", "Vihaan", "Ananya", "Reyansh", "Saanvi", "Arjun", "Myra", "Rohan",
         "Kiara", "Aditya", "Tara", "Nikhil", "Zara", "Karan", "Meher", "Dev", "Riya", "Yash", "Pooja", "Neel",
         "Sneha", "Om", "Lavanya", "Ishaan", "Fatima", "Joseph", "Gurpreet"]
LAST = ["Sharma", "Iyer", "Khan", "Reddy", "Mehta", "Nair", "Gupta", "Das", "Patel", "Singh", "Rao", "Bose",
        "Menon", "Kulkarni", "Chatterjee", "D'Souza", "Verma", "Pillai"]
COMPANIES = ["Sunrise Traders Pvt Ltd", "Kaveri Exports LLP", "Bluepeak Logistics", "Indus Agro Foods",
             "Nimbus Software Pvt Ltd", "Saffron Textiles", "Monsoon Hospitality", "Vertex Pharma Distributors",
             "Coastal Seafoods", "Himalaya Hardware Mart"]
NPOS = ["Asha Seva Trust", "Green Earth Foundation", "Vidya Daan Society"]
SAFE_COUNTRIES = ["US", "GB", "AE", "SG", "DE", "AU"]


@dataclass
class CustomerRow:
    id: str
    name: str
    type: str
    risk: str
    is_pep: bool
    has_pan: bool
    pan: str
    kyc_last_updated: str
    country: str = "IN"


@dataclass
class AccountRow:
    id: str
    customer_id: str
    account_number: str
    type: str
    opened_on: str


@dataclass
class TxnRow:
    id: str
    account_id: str
    timestamp: str
    amount_inr: float
    currency: str
    channel: str
    direction: str
    counterparty_id: str
    counterparty_country: str
    purpose_code: str


@dataclass
class TruthRow:
    transaction_id: str
    scenario: str
    expected_rules: str
    expected_obligations: str


RULE_OBLIGATIONS = {
    "R-CTR": "CTR",
    "R-STRUCT": "STR",
    "R-CBWTR": "CBWTR",
    "R-NPO": "NTR",
    "R-CASH-RECEIPT": "CASH_LIMIT_ALERT",
    "R-PAN": "PAN_REQUIRED",
    "R-LRS": "LRS_LIMIT_BREACH",
    "R-HRJ": "EDD",
    "R-PEP": "EDD",
    "R-KYC-DUE": "KYC_UPDATE",
}


@dataclass
class Dataset:
    customers: list[CustomerRow] = field(default_factory=list)
    accounts: list[AccountRow] = field(default_factory=list)
    transactions: list[TxnRow] = field(default_factory=list)
    truth: list[TruthRow] = field(default_factory=list)


class _Gen:
    def __init__(self, seed: int = SEED):
        self.rng = random.Random(seed)
        self.ds = Dataset()
        self._txn_seq = 0

    def pan(self) -> str:
        letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        r = self.rng
        return "".join(r.choice(letters) for _ in range(5)) + f"{r.randint(1000, 9999)}" + r.choice(letters)

    def customer(self, cid: str, name: str, ctype: str, risk: str, *, pep=False, has_pan=True,
                 kyc: date | None = None) -> CustomerRow:
        kyc = kyc or (END_DATE - timedelta(days=self.rng.randint(30, 330)))
        row = CustomerRow(cid, name, ctype, risk, pep, has_pan, self.pan() if has_pan else "", kyc.isoformat())
        self.ds.customers.append(row)
        return row

    def account(self, customer: CustomerRow, idx: int) -> AccountRow:
        aid = f"A{len(self.ds.accounts) + 1:04d}"
        acc_type = "current" if customer.type != "individual" else self.rng.choice(["savings", "savings", "current"])
        number = f"{self.rng.randint(10, 99)}{self.rng.randint(10**9, 10**10 - 1)}"
        opened = date(2015 + (idx % 9), 1 + idx % 12, 1 + idx % 27)
        row = AccountRow(aid, customer.id, number, acc_type, opened.isoformat())
        self.ds.accounts.append(row)
        return row

    def txn(self, account: AccountRow, when: datetime, amount: float, channel: str, direction: str, *,
            counterparty: str = "", country: str = "IN", purpose: str = "") -> TxnRow:
        self._txn_seq += 1
        row = TxnRow(f"T{self._txn_seq:05d}", account.id, when.isoformat(timespec="seconds"), round(amount, 2), "INR",
                     channel, direction, counterparty, country, purpose)
        self.ds.transactions.append(row)
        return row

    def plant(self, account: AccountRow, day: str, amount: float, channel: str, direction: str,
              scenario: str, rules: list[str], *, hour: int = 11, **kw) -> TxnRow:
        when = datetime.fromisoformat(f"{day}T{hour:02d}:{self.rng.randint(0, 59):02d}:00")
        row = self.txn(account, when, amount, channel, direction, **kw)
        self.ds.truth.append(TruthRow(row.id, scenario, ";".join(rules),
                                      ";".join(sorted({RULE_OBLIGATIONS[r] for r in rules}))))
        return row

    def random_time(self) -> datetime:
        offset = self.rng.randint(0, (END_DATE - START_DATE).days)
        d = START_DATE + timedelta(days=offset)
        return datetime(d.year, d.month, d.day, self.rng.randint(8, 20), self.rng.randint(0, 59))

    def normal_txn(self, account: AccountRow, ctype: str) -> TxnRow:
        r = self.rng
        when = self.random_time()
        if ctype == "npo":
            return self.txn(account, when, r.uniform(5_000, 9_00_000), r.choice(["NEFT", "RTGS", "UPI"]), "credit")
        weights = {"UPI": 34, "IMPS": 12, "NEFT": 18, "card": 14, "cash": 12, "RTGS": 4, "SWIFT": 6}
        channel = r.choices(list(weights), weights=list(weights.values()))[0]
        direction = r.choice(["credit", "debit"])
        if channel == "UPI":
            amount = r.uniform(50, 40_000)
        elif channel == "IMPS":
            amount = r.uniform(1_000, 1_50_000)
        elif channel == "NEFT":
            amount = r.uniform(5_000, 4_00_000)
        elif channel == "card":
            amount, direction = r.uniform(200, 60_000), "debit"
        elif channel == "cash":
            amount = r.uniform(1_000, 35_000)
            cp = f"P{r.randint(100, 999)}" if (ctype == "company" and direction == "credit") else ""
            return self.txn(account, when, amount, "cash", direction, counterparty=cp)
        elif channel == "RTGS":
            amount = r.uniform(2_00_000, 8_00_000)
        else:  # inward SWIFT remittance from a low-risk country, below CBWTR threshold
            return self.txn(account, when, r.uniform(20_000, 4_50_000), "SWIFT", "credit",
                            country=r.choice(SAFE_COUNTRIES), purpose="P1301")
        return self.txn(account, when, amount, channel, direction)


def generate(seed: int = SEED) -> Dataset:
    g = _Gen(seed)
    r = g.rng

    def person() -> str:
        return f"{r.choice(FIRST)} {r.choice(LAST)}"

    # ---------------- planted scenarios (C001–C014) ----------------
    c = g.customer("C001", person(), "individual", "medium")
    a = g.account(c, 1)
    g.plant(a, "2026-09-03", 12_50_000, "cash", "credit", "large_cash", ["R-CTR"])

    c = g.customer("C002", person(), "individual", "medium")
    a = g.account(c, 2)
    for d, amt, rules in [("2026-08-04", 3_00_000, []), ("2026-08-11", 2_80_000, []),
                          ("2026-08-19", 2_60_000, []), ("2026-08-26", 2_90_000, ["R-CTR"])]:
        g.plant(a, d, amt, "cash", "credit", "monthly_cash_aggregate", rules)

    c = g.customer("C003", person(), "individual", "medium", has_pan=False)
    a = g.account(c, 3)
    for d, amt, rules in [("2026-09-14", 49_000, []), ("2026-09-15", 48_500, []),
                          ("2026-09-17", 47_200, ["R-STRUCT"]), ("2026-09-18", 49_900, ["R-STRUCT"])]:
        g.plant(a, d, amt, "cash", "credit", "structuring_pan_threshold", rules)

    c = g.customer("C004", COMPANIES[0], "company", "medium")
    a = g.account(c, 4)
    for d, amt, rules in [("2026-10-05", 9_60_000, []), ("2026-10-07", 9_20_000, ["R-CTR"]),
                          ("2026-10-09", 9_80_000, ["R-CTR", "R-STRUCT"])]:
        g.plant(a, d, amt, "cash", "credit", "structuring_ctr_threshold", rules)

    c = g.customer("C005", person(), "individual", "low")
    a = g.account(c, 5)
    g.plant(a, "2026-08-20", 18_00_000, "SWIFT", "credit", "cross_border_wire", ["R-CBWTR"], country="US",
            purpose="P1301")
    g.plant(a, "2026-09-22", 7_50_000, "SWIFT", "debit", "cross_border_wire", ["R-CBWTR"], country="GB",
            purpose="S0306")

    c = g.customer("C006", COMPANIES[1], "company", "high")
    a = g.account(c, 6)
    g.plant(a, "2026-09-09", 3_20_000, "SWIFT", "credit", "high_risk_jurisdiction", ["R-HRJ"], country="IR",
            purpose="P0102")
    g.plant(a, "2026-10-02", 6_50_000, "SWIFT", "debit", "high_risk_jurisdiction", ["R-CBWTR", "R-HRJ"],
            country="MM", purpose="S0102")

    c = g.customer("C007", person(), "individual", "high", pep=True)
    a = g.account(c, 7)
    g.plant(a, "2026-08-12", 4_50_000, "NEFT", "credit", "pep", ["R-PEP"])
    g.plant(a, "2026-09-28", 12_00_000, "RTGS", "debit", "pep", ["R-PEP"])

    c = g.customer("C008", NPOS[0], "npo", "medium")
    a = g.account(c, 8)
    g.plant(a, "2026-08-30", 15_00_000, "NEFT", "credit", "npo_large_receipt", ["R-NPO"])
    g.plant(a, "2026-09-12", 2_00_000, "NEFT", "credit", "npo_normal_receipt", [])
    g.plant(a, "2026-10-10", 25_00_000, "RTGS", "credit", "npo_large_receipt", ["R-NPO"])

    c = g.customer("C009", person(), "individual", "medium", has_pan=False)
    a = g.account(c, 9)
    g.plant(a, "2026-09-25", 75_000, "cash", "credit", "cash_without_pan", ["R-PAN"])

    c = g.customer("C010", COMPANIES[2], "company", "medium")
    a = g.account(c, 10)
    g.plant(a, "2026-08-08", 2_50_000, "cash", "credit", "cash_receipt_limit", ["R-CASH-RECEIPT"],
            counterparty="P-0077")
    g.plant(a, "2026-09-16", 1_20_000, "cash", "credit", "cash_receipt_limit", [], hour=10, counterparty="P-0088")
    g.plant(a, "2026-09-16", 90_000, "cash", "credit", "cash_receipt_limit", ["R-CASH-RECEIPT"], hour=15,
            counterparty="P-0088")

    c = g.customer("C011", person(), "individual", "medium")
    a = g.account(c, 11)
    for d, usd, rules in [("2026-07-28", 95_000, ["R-CBWTR"]), ("2026-08-25", 90_000, ["R-CBWTR"]),
                          ("2026-10-01", 80_000, ["R-CBWTR", "R-LRS"])]:
        g.plant(a, d, usd * USD_INR, "SWIFT", "debit", "lrs_cumulative_breach", rules, country="US", purpose="S0305")

    c = g.customer("C012", person(), "individual", "high", kyc=date(2023, 6, 1))
    a = g.account(c, 12)
    g.plant(a, "2026-08-02", 5_000, "UPI", "debit", "kyc_overdue", ["R-KYC-DUE"])
    g.plant(a, "2026-09-10", 40_000, "NEFT", "credit", "kyc_overdue", ["R-KYC-DUE"])

    c = g.customer("C013", COMPANIES[3], "company", "medium", kyc=date(2017, 3, 1))
    a = g.account(c, 13)
    g.plant(a, "2026-09-03", 1_20_000, "NEFT", "debit", "kyc_overdue", ["R-KYC-DUE"])

    c = g.customer("C014", person(), "individual", "high", pep=True)
    a = g.account(c, 14)
    g.plant(a, "2026-10-12", 8_00_000, "SWIFT", "credit", "pep_high_risk_wire", ["R-CBWTR", "R-HRJ", "R-PEP"],
            country="KP", purpose="P1301")

    # Low-value, rule-neutral traffic on planted accounts (C001–C011 only; KYC/PEP customers stay clean).
    for acc in g.ds.accounts[:11]:
        for _ in range(r.randint(2, 4)):
            when = g.random_time()
            g.txn(acc, when, r.uniform(100, 25_000), r.choice(["UPI", "IMPS", "card"]), "debit")

    # ---------------- normal customers (C015–C050) ----------------
    types = ["individual"] * 27 + ["company"] * 7 + ["npo"] * 2
    r.shuffle(types)
    company_pool = iter(COMPANIES[4:] + [f"{n} Enterprises" for n in LAST])
    npo_pool = iter(NPOS[1:])
    normal_accounts: list[tuple[AccountRow, str]] = []
    for i, ctype in enumerate(types, start=15):
        name = person() if ctype == "individual" else next(company_pool) if ctype == "company" else next(npo_pool)
        cust = g.customer(f"C{i:03d}", name, ctype, r.choice(["low", "low", "medium"]))
        for k in range(2 if i % 2 == 0 and i < 55 else 1):
            normal_accounts.append((g.account(cust, i + k), ctype))

    target = 600
    while len(g.ds.transactions) < target:
        acc, ctype = r.choice(normal_accounts)
        g.normal_txn(acc, ctype)

    g.ds.transactions.sort(key=lambda t: t.timestamp)
    return g.ds


def write_dataset(ds: Dataset, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, rows in [("customers", ds.customers), ("accounts", ds.accounts),
                       ("transactions", ds.transactions), ("ground_truth", ds.truth)]:
        path = out_dir / f"{name}.csv"
        with path.open("w", newline="", encoding="utf-8") as fh:
            dicts = [asdict(x) for x in rows]
            writer = csv.DictWriter(fh, fieldnames=list(dicts[0].keys()))
            writer.writeheader()
            writer.writerows(dicts)


def read_ground_truth(path: Path) -> dict[str, TruthRow]:
    with path.open(encoding="utf-8") as fh:
        return {row["transaction_id"]: TruthRow(**row) for row in csv.DictReader(fh)}
