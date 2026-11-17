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
```

## HTTP

- `GET /api/v1/capabilities`
- `GET /api/v1/works?q=SPRINT&limit=5`
- `POST /api/v1/traverse/openalex-to-nih-reporter`
- `POST /api/v1/traverse/openalex-to-clinical-trials`
- `GET /api/v1/investigate?pmid=36223105`
- `GET /api/v1/health`, `/api/v1/openapi.json`, `/api/v1/examples`
- `POST /mcp` — Streamable HTTP MCP with `list_countries`, `list_corridors`, `resolve_boundary`, `traverse_corridor`, and `investigate_research_chain`

Investigation accepts exactly one of `work_id`, `pmid`, `nct_id`, or `project_id`. Export from the inspector preserves the entire DAG and every envelope, not screen coordinates.

## Principles

- Exact identifiers outrank and exclude approximation from verified evidence.
- RePORTER amounts are project-record/fiscal-year amounts, never attributed to the cost of a paper.
- Missing and failed branches remain inspectable.
- Adding a country means adding an adapter, corridor, and registry declaration; core orchestration does not change.
- Standard CI is fixture-backed and offline. Live smoke tests may fail explicitly on an upstream outage but never substitute fixtures as production success.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md).
