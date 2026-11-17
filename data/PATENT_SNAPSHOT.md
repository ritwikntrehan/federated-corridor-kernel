# Patent snapshot provenance

This bounded, Worker-safe index contains two actual granted-US-patent records: one positive NIH government-interest demonstration and one patent-first demonstration. It is not a claim of comprehensive coverage.

- Source family: PatentsView PatentSearch / USPTO public patent-grant data (CC BY 4.0).
- Dataset coverage date: 2024-06-30, as reported for PatentSearch API 2.1.2.
- Record-level verification URLs are stored on every row.
- Extracted 2026-11-17; 2 patent rows, 1 government-interest row, 0 non-patent-literature identifier rows.
- Extraction: `node scripts/extract_patent_snapshot.mjs <export.json>`.

The normalized NIH core `R01MH099993` is derived conservatively from the preserved source text `R01 MH99993`. The extract intentionally contains no SPRINT patent and therefore makes no SPRINT-to-patent claim.
