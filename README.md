# Five-Country Research Instrument

An interactive, source-backed research graph across OpenAlex, NIH RePORTER, ClinicalTrials.gov, USPTO patent grants, and openFDA. Every relationship is explicitly `verified` or `hypothesis`; graph proximity never implies funding, causality, commercialization, ownership, or regulatory reliance.

The v0.2 milestone is preserved at commit `d88cf6a82493a369b46bf730980dac7ba0e5c45c`. v0.3 adds reverse NCT discovery, snapshot-backed patents, live openFDA records, six investigation entry types, real graph pivots, and per-record source-mode transparency.

## Run locally

```bash
npm install
npm run dev
npm run check
```

No new credential is required. Optional environment variables are `OPENALEX_API_KEY`, `OPENFDA_API_KEY`, and `USPTO_ODP_API_KEY`. The last is reserved for verified future live enrichment; the mandatory patent path uses the attributable public snapshot in `data/`. Keys are added only to outbound requests and are excluded from passports, cache keys, logs, and exports.

```bash
npm run test:live
npm run benchmark:utility:v03
```

## Entry points

`POST /api/v1/investigate` accepts:

```json
{
  "entry_type": "trial | publication | nih_project | patent | fda_product | topic",
  "entry_id": "NCT01206062",
  "max_nodes": 40,
  "max_hops": 2,
  "include_hypothesis_edges": false
}
```

Topic uses `query` instead of `entry_id`. Provider/corridor arrays and a continuation token are optional. `GET /api/v1/investigate` remains backward compatible with `work_id`, `pmid`, `nct_id`, or `project_id`. Other routes include `POST /api/v1/cohort`, `POST /api/v1/traverse/:corridorId`, and the OpenAPI/capabilities/health endpoints.

MCP retains all prior tools and adds `investigate_entity`. The browser inspector supports universal entry, grounded presets, solid verified edges, dashed hypothesis edges, source/passport inspection, cancellation-safe switching, deterministic merge/deduplication, pivoting from any node, and complete JSON export.

## Evidence rules

- An exact title/abstract NCT token is `mentions_registered_trial`; it is not automatically a results publication.
- A patent government-interest statement containing an exact conservatively normalized NIH core is `acknowledges_government_award`; assignee data does not prove current ownership or commercialization.
- Drug approvals, drug labels, and 510(k) device clearances remain distinct. Exact shared FDA application IDs may join records without conflating their regulatory meaning.
- Sponsor, ingredient, intervention, institution, topic, and assignee similarities can only be hypotheses.
- The external-request ceiling is 45; provider failure preserves successful countries and returns partial evidence.

See [ARCHITECTURE.md](ARCHITECTURE.md), [data/PATENT_SNAPSHOT.md](data/PATENT_SNAPSHOT.md), [UTILITY_PROOF_V03.md](UTILITY_PROOF_V03.md), and [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md).
