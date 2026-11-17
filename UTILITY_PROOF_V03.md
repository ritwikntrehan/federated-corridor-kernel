# Utility proof v0.3 — fixed 15-trial rerun

**Run:** 2026-11-17T08:29:22.909Z  
**Mode:** live OpenAlex/openFDA plus verified public patent snapshot  
**v0.2 milestone:** `d88cf6a82493a369b46bf730980dac7ba0e5c45c`

## Observed result

- Previously unlinked in v0.2: **13**.
- Previously unlinked trials gaining an exact title/abstract NCT mention: **1**.
- Unique connected OpenAlex works: **1**.
- Unique NIH cores on those works: **0**.
- Patents with a verified government-interest join from those cores: **0**.
- Exact openFDA label records: **0**.
- Verified edges: **1**; hypothesis edges: **0**.
- Live requests: **30**; snapshot patents available: **2**; budget stops: **0**.

No minimum join count was imposed. Search candidates without an exact bounded NCT token were rejected. A label mention is not claimed to be pivotal approval evidence. The snapshot contains no SPRINT patent and no DOI/PMID non-patent-literature row, so those joins remain empty.

| NCT ID | exact OpenAlex mentions | NIH cores | exact FDA label mentions | provider errors |
|---|---:|---|---:|---|
| NCT05753007 | 0 | none | 0 | — |
| NCT00006092 | 0 | none | 0 | — |
| NCT00862134 | 0 | none | 0 | — |
| NCT00330564 | 0 | none | 0 | — |
| NCT00003516 | 0 | none | 0 | — |
| NCT01938833 | 0 | none | 0 | — |
| NCT00179738 | 0 | none | 0 | — |
| NCT00209014 | 0 | none | 0 | — |
| NCT00004221 | 0 | none | 0 | — |
| NCT03773133 | 0 | none | 0 | — |
| NCT02543749 | 0 | none | 0 | — |
| NCT03109847 | 0 | none | 0 | — |
| NCT02162758 | 0 | none | 0 | — |
| NCT04690855 | 1 | none | 0 | — |
| NCT02013778 | 0 | none | 0 | — |

Machine-readable request URLs, outcomes, source modes, counts, and errors are in `benchmarks/results/utility-proof-v03.json`. API keys are removed.
