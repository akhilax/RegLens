# RegLens — 5-minute demo script

**Before you start:** `npm run seed` (fresh data), then `npm run dev`, open http://localhost:5173 in a
full-screen browser, dark mode. Reviewer starts as **Asha Menon (AML Analyst)**.

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | **Landing** | Let the hero animate; scroll once to the pipeline. | "Banks have to decide which AML, KYC, tax and FEMA rules apply to every transaction. RegLens does it with a citation for every claim and a human for every decision that matters. Seven steps — rules, retrieval, LLM, guardrail, human, audit — and every hop is recorded." |
| 0:30 | Click **Launch Console** → Dashboard | Point at KPIs, risk pulse, deadline countdowns. | "600 synthetic transactions. 24 flagged by deterministic rules, 21 waiting for a human, and 4 hallucinated citations already blocked." |
| 0:50 | **Run Analysis** | Click **Analyse all transactions**. | "Live over Server-Sent Events: every transaction goes through rules, hybrid BM25 + vector retrieval, a constrained LLM, then the citation guardrail. Flagged ones stream in." Optionally drop `sample-transactions.csv`. |
| 1:30 | **Review Queue** | Press `J`/`K` to move, then open the **R-STRUCT ₹9,80,000** card — the one with the red border beam (shared-element zoom). | "Structuring: three cash deposits at 92–98% of ₹10 lakh in five days. That's an STR *candidate* — the rule never decides suspicion; a human does." |
| 1:55 | Card → **Full trace** | Watch the graph build; click a clause node; open the **Rules** tab. | "Here's the full trace: features, the rules that fired with their evidence, the exact clauses retrieved — version and SHA-256 — the model and prompt version. The model tried to cite `sec-…-hallucinated`; the guardrail struck it out and routed this to a human." |
| 2:40 | Back to queue, open the same card | **Hold to approve STR** (press and hold). | "High-stakes actions are hold-to-confirm. That's approval one of two." |
| 2:55 | Top bar → switch to **Ravi Kulkarni (MLRO)** | Hold to approve again → confetti. | "Four-eyes: a different reviewer must approve. Now the STR clock starts — 7 working days from determination, computed by the rules, not the LLM." Open **DRAFT reports → STR · CSV**. |
| 3:25 | **Knowledge Base** | Click **Load demo amendment · PML Rules v2**. | "Regulations change. A (hypothetical) v2 tightens aggregation and the STR timeline. Old chunks are kept as superseded; here's the clause-level diff, and these six decisions cited a changed clause — they're automatically flagged for re-review." |
| 4:05 | **Audit Log** | **Verify integrity**, then **Simulate tampering**. | "Every analysis, review and KB change is hash-chained. Verify ticks every block green. If anyone edits one historic entry, that block and everything after it breaks." |
| 4:35 | **Evaluation** | Let gauges fill. | "Against synthetic ground truth: every planted scenario detected, zero false positives on normal traffic, every hallucinated citation stripped, and only 3.5% of transactions need a human." |
| 4:50 | Ctrl/⌘ K → type `T00012` | Jump to it. | "Runs fully offline in mock mode — flip one env var for Claude or Ollama. Thank you." |

**Backup lines**
* *"Why not let the LLM decide?"* — Numbers and deadlines are legal facts; we keep them deterministic and
  auditable. The LLM explains applicability and is fenced by retrieval and the guardrail.
* *"What if the model is wrong?"* — Invalid JSON → one retry → rules-only fallback, always routed to a human.
* *"Is this the real law?"* — No: paraphrased demo summaries with a banner on every document; it's a prototype.
