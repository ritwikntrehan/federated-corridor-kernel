# Architecture

The kernel is deliberately smaller than every source adapter. It knows boundary names, envelopes, evidence nodes/edges, corridor declarations, compatibility checks, bounded execution, and registry discovery. It does not know OpenAlex field paths, RePORTER URLs, or trial schemas.

```text
REST / MCP / inspector
        │
 investigation service ───── complete graph + envelopes
        │
 declarative registry ────── type compatibility / limits
      ╱   ╲
 OpenAlex→RePORTER   OpenAlex↔ClinicalTrials.gov
      │                         │
 source adapters + source-specific Zod response probes
```

## Transformations

- Lossless: raw award identifier preservation, source URLs/record IDs, NCT ID, PMID, DOI, phases, status, project number, application ID, core project ID, fiscal year, and award amount.
- Partial: OpenAlex native records projected into minimal work/award boundaries; RePORTER records projected into a project-year boundary; trial records projected into status/reference summaries. Raw records or reproducible source references remain beside projections.
- Conservative normalization: NIH core-project extraction accepts a narrow activity/institute/serial pattern. Ambiguous or contract-style identifiers remain visible and unsupported.
- Identity: `identity()` structured-clones an envelope and preserves canonical payload/evidence.
- Composition: registry composition rejects output/input boundary mismatches before calling an adapter.
- Practical commuting check: independent identity claims are compared and reported as agreement or conflict; conflicts are never auto-merged.

## Failure and caching model

Each corridor returns a complete, partial, or failed envelope. A provider failure does not discard successful branches. KV is optional; a bounded in-memory cache keeps local/preview operation functional. RePORTER requests are serialized to roughly one request per second on cache misses. No arbitrary URL fetch or unbounded traversal exists.

## Trust boundary

Only exact award/core-project, PMID, DOI, and NCT evidence can create verified edges. Similarity is a declared but disabled candidate method. The graph validator requires every edge endpoint to be a source-backed node.
