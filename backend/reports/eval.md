# RegLens evaluation report

Generated 2026-10-19T06:31:55+00:00 · provider `mock:mock-reglens-1` · 600 transactions

## Identification quality (micro-averaged)

| Target | Precision | Recall | F1 | TP | FP | FN |
|---|---|---|---|---|---|---|
| Rules fired | 1.000 | 1.000 | 1.000 | 29 | 0 | 0 |
| Obligations | 1.000 | 1.000 | 1.000 | 28 | 0 | 0 |
| Applicable regulations | 1.000 | 1.000 | 1.000 | 39 | 0 | 0 |

## Per rule

| Rule | Precision | Recall | F1 | TP | FP | FN |
|---|---|---|---|---|---|---|
| R-CASH-RECEIPT | 1.000 | 1.000 | 1.000 | 2 | 0 | 0 |
| R-CBWTR | 1.000 | 1.000 | 1.000 | 7 | 0 | 0 |
| R-CTR | 1.000 | 1.000 | 1.000 | 4 | 0 | 0 |
| R-HRJ | 1.000 | 1.000 | 1.000 | 3 | 0 | 0 |
| R-KYC-DUE | 1.000 | 1.000 | 1.000 | 3 | 0 | 0 |
| R-LRS | 1.000 | 1.000 | 1.000 | 1 | 0 | 0 |
| R-NPO | 1.000 | 1.000 | 1.000 | 2 | 0 | 0 |
| R-PAN | 1.000 | 1.000 | 1.000 | 1 | 0 | 0 |
| R-PEP | 1.000 | 1.000 | 1.000 | 3 | 0 | 0 |
| R-STRUCT | 1.000 | 1.000 | 1.000 | 3 | 0 | 0 |

## Planted scenarios

| Scenario | Transactions | Exactly detected |
|---|---|---|
| cash_receipt_limit | 3 | 3 |
| cash_without_pan | 1 | 1 |
| cross_border_wire | 2 | 2 |
| high_risk_jurisdiction | 2 | 2 |
| kyc_overdue | 3 | 3 |
| large_cash | 1 | 1 |
| lrs_cumulative_breach | 3 | 3 |
| monthly_cash_aggregate | 4 | 4 |
| npo_large_receipt | 2 | 2 |
| npo_normal_receipt | 1 | 1 |
| pep | 2 | 2 |
| pep_high_risk_wire | 1 | 1 |
| structuring_ctr_threshold | 3 | 3 |
| structuring_pan_threshold | 4 | 4 |

## Guardrails, routing and latency

- Citations kept: **72**, hallucinated citations stripped: **4** (raw validity 94.7%; 100% after guardrail)
- Routed to human review: **21** (3.5% of transactions)
- Flagging confusion: {'tn': 576, 'tp': 24}
- Latency per transaction: mean 14.69 ms, p95 16.21 ms

_Educational prototype. Ground truth is synthetic; regulatory summaries must be verified._
