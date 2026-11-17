# Architecture

```text
REST / MCP / interactive inspector
                 │
 bounded multi-entry investigation (≤45 external requests)
                 │
 typed corridor registry + DiplomaticEnvelope provenance
       ┌─────────┼──────────┬───────────┐
   OpenAlex   RePORTER   ClinicalTrials   USPTO snapshot   openFDA
```

The kernel owns boundary validation, evidence tiers, relation types, envelopes, request ceilings, deduplication, continuation, and partial failure. Each adapter owns source URLs, response probes, field semantics, caching, and projections.

## Countries and crossings

- OpenAlex ↔ ClinicalTrials.gov: exact PMID/DOI references and reverse exact NCT mentions reconstructed from `abstract_inverted_index`.
- OpenAlex → NIH RePORTER: preserved funder award normalized to an exact NIH core.
- NIH RePORTER → USPTO: exact NIH core in a patent government-interest record from the public snapshot.
- ClinicalTrials.gov → openFDA: exact NCT token in returned label JSON.
- openFDA application → label: exact shared application number. Drug applications and device 510(k) clearances have separate node types and summary counters.

Patent non-patent-literature joins remain unavailable because the bounded extract has no DOI/PMID citation rows. Optional USPTO live access is not treated as available until an endpoint is probed and shown to expose grant and government-interest fields.

## Trust and failure model

Verified edges require exact source evidence. Similarity never becomes verified because of a score. Missing abstracts, search false positives, unsupported patents, no-match labels, provider outages, and isolated nodes are ordinary outcomes. Successful provider records survive failures elsewhere.

KV is optional; local and preview operation use a bounded memory cache. API keys are excluded from public request URLs and cache keys. Snapshot nodes carry `data_mode`, `snapshot_source`, and `snapshot_date`; live FDA nodes carry `data_mode: live_api`.
