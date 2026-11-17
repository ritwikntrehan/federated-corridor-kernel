# Federated Corridor Kernel

A typed, source-backed boundary-object mesh connecting OpenAlex, NIH RePORTER, and ClinicalTrials.gov. Every crossing returns a `DiplomaticEnvelope`: passport, customs result, resident interpretation, payload, evidence graph, and explicit errors.

The verified demo starts at PMID `36223105`, reaches OpenAlex work `W4304757292`, exact NIH project-year records for `R01HL136679`, and ClinicalTrials.gov study `NCT01206062`. See [JOIN_EVIDENCE.md](JOIN_EVIDENCE.md) for what that chain proves—and what it does not.

## Run locally

```bash
npm install
npm run dev
```

No API key or AI call is required. Open the printed local URL and click **Load verified SPRINT example**.

```bash
npm run check       # strict typecheck, deterministic tests, production build
npm run test:live   # opt-in current-upstream smoke checks
npm run benchmark:utility # opt-in live 15-seed workloads; writes UTILITY_PROOF.md + JSON
```

## HTTP

- `GET /api/v1/capabilities`
- `GET /api/v1/works?q=SPRINT&limit=5`
- `POST /api/v1/traverse/openalex-to-nih-reporter`
- `POST /api/v1/traverse/openalex-to-clinical-trials`
- `GET /api/v1/investigate?pmid=36223105`
- `POST /api/v1/cohort` — constrained ClinicalTrials.gov, NIH RePORTER, or OpenAlex cohort traversal (15 seeds by default, 25 maximum)
- `GET /api/v1/health`, `/api/v1/openapi.json`, `/api/v1/examples`
- `POST /mcp` — Streamable HTTP MCP with the five v0.1 tools plus `traverse_cohort`

Investigation accepts exactly one of `work_id`, `pmid`, `nct_id`, or `project_id`. Export from the inspector preserves the entire DAG and every envelope, not screen coordinates.

The cohort endpoint defaults to exact links only (`include_hypothesis_edges=false`), reports a denominator-defined per-corridor funnel and drop-offs, and returns a continuation when the Worker request budget is reached. See [BENCHMARK_METHOD.md](BENCHMARK_METHOD.md) and the genuine live observations in [UTILITY_PROOF.md](UTILITY_PROOF.md).

## Principles

- Exact identifiers outrank and exclude approximation from verified evidence.
- RePORTER amounts are project-record/fiscal-year amounts, never attributed to the cost of a paper.
- Missing and failed branches remain inspectable.
- Adding a country means adding an adapter, corridor, and registry declaration; core orchestration does not change.
- Standard CI is fixture-backed and offline. Live smoke tests may fail explicitly on an upstream outage but never substitute fixtures as production success.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md).
