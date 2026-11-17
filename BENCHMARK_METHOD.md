# Benchmark method

## Scope

Version 0.2 tests bounded, reproducible multi-entity utility across the existing OpenAlex, NIH RePORTER, and ClinicalTrials.gov boundaries. The benchmark is opt-in (`npm run benchmark:utility`) and uses live providers. Deterministic CI uses sanitized fixtures and cannot generate a claimed live utility report.

## Golden control

The independent positive control is OpenAlex work `W4304757292` / PMID `36223105`, NIH core project `R01HL136679`, and ClinicalTrials.gov study `NCT01206062`. The OpenAlex-to-RePORTER relationship means an OpenAlex award identifier conservatively normalized to the exact RePORTER core project. RePORTER amounts remain application/project-record fiscal-year amounts. The publication-to-trial relationship means ClinicalTrials.gov listed the exact PMID. Neither relationship is causal.

## Cohort definitions and sampling

1. Terminated trials: `query.cond=oncology`, `filter.overallStatus=TERMINATED`, `filter.advanced=AREA[Phase]PHASE2 AND AREA[StudyType]INTERVENTIONAL`, page size 15. Returned status, phase, and study type are validated again. The first 15 validated records in provider order are retained without preselecting records that have publication references.
2. NIH projects: project-title advanced text `cardiovascular`, fiscal years 2016–2022, activity codes R01/U01, then the first 15 distinct core project numbers in core-project order. Application and fiscal-year rows remain separate and are deduplicated by application ID before monetary summaries.
3. Candidate audit: the exact Benchmark 1 query is repeated with candidate generation enabled. Verified relationships must be identical. With no defensible shared attributes, zero candidates plus `missing_candidate_attributes` is the expected honest result.

Maximum seeds default to 15 and are capped at 25. A Worker traversal stops before 45 external cache misses, reserving five of Cloudflare's 50 external subrequests. It returns a partial result and seed offset continuation. The Node-side live benchmark uses a separate 200-request ceiling so all 15 project seeds can be audited, while retaining the same bounded pagination and shared RePORTER one-request-per-second limiter.

Funnel denominators are explicit: `seeds_discovered` is the number of candidate seed identifiers observed within bounded discovery (provider total for trial/work searches when supplied; unique NIH cores within at most four 50-row pages), `seeds_selected` is the bounded slice, `seeds_attempted` entered traversal, and `seeds_completed` finished before a budget stop. Corridor attempts count identifier-bearing branch attempts, not seeds. Provider requests count cache misses; cache hits, pre-request deduplication, timeouts, retries, and budget stops are separate counters.

## Field semantics

- OpenAlex annual `counts_by_year` values are used only for years the work record actually returns. Missing historical years are not reconstructed. Post-date citations are an approximation only when the trial date proxy and returned annual coverage overlap.
- RePORTER `award_amount`, `direct_cost_amt`, and `indirect_cost_amt` are kept distinct. No reconciliation identity is assumed. Aggregation requires unique application/fiscal-year records; missing values are excluded and counted.
- ClinicalTrials.gov enrollment preserves its `ACTUAL` or `ESTIMATED` type. `TERMINATED` and `whyStopped` are registry attributes and do not establish scientific failure.
- Exact PMID, DOI, NCT, or conservatively normalized NIH core identifiers create `verified` relationships. Candidate associations remain `hypothesis`, carry their compared fields and uncalibrated basis, and never modify verified counts.

## Reproducibility and failure policy

The JSON artifact records UTC run time, Git commit, full constrained queries, selected IDs, provider request URLs/bodies represented by envelopes and query objects, telemetry, provenance, raw sanitized evidence embedded in graph nodes, and all unmatched/error branches. API keys are removed. Required-provider errors make the run degraded and the command exits non-zero. `tests/live.smoke.test.ts` likewise fails on a genuine provider exception when live mode is enabled.
