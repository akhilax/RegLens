# RegLens — pitch outline (7 slides)

## 1. Title
**RegLens — every compliance decision, traced to the clause.**
Traceable RAG + deterministic rules + human approval for Indian AML/KYC/tax/FEMA obligations.
Visual: landing hero screenshot.

## 2. The problem
* Reporting entities must map every transaction to CTR / STR / CBWTR / NTR, PAN, LRS, EDD and KYC duties — with tight deadlines (15th of next month; 7 working days for STR).
* Manual review doesn't scale; a raw LLM invents thresholds and citations and can't be audited.
* Regulations change, and nobody knows which past decisions are affected.

## 3. Our approach (architecture)
Transaction → **Rules** (every number) → **Hybrid RAG** over a versioned, hash-identified KB → **LLM** (strict JSON) → **Guardrail** → **Human** (four-eyes for STR) → **Audit chain**.
Visual: Mermaid architecture diagram / animated pipeline.

## 4. Trust by design
* Citation guardrail: only retrieved chunks may be cited; violations are stripped and routed to a human.
* Obligations and deadlines always come from rules, never the LLM.
* Hash-chained audit log; tamper detection demo.
* Regulation change → clause diff → impacted decisions flagged for re-review.
Visual: decision trace graph with a struck-through citation.

## 5. Live demo highlights
Structuring case → trace → hold-to-approve, second approver → KB amendment impact → audit tamper.
Visual: review queue + four-eyes screenshot.

## 6. Results
* 14/14 planted scenarios detected, 0 false positives on normal traffic (synthetic ground truth).
* 4/4 hallucinated citations stripped (raw validity 94.7% → 100%).
* 3.5% of transactions routed to humans; ~15 ms per transaction (mock).
* Runs fully offline; Claude / Ollama via one env var. 57 backend tests, Playwright visual QA.
Visual: evaluation gauges.

## 7. What's next
* Real-LLM evaluation on a larger, expert-labelled set; FIU-IND FINnet XML exports.
* More rules (counterfeit currency, TDS 194N, SFT aggregation, sanctions screening).
* Postgres + WORM audit storage, SSO and role-based approvals.
* Disclaimer: educational prototype, not legal advice.
