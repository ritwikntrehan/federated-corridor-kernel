# Join evidence

Verification date: **2026-11-16**. These are source-backed golden examples, not hand-authored production graph edges. Sanitized response slices live in [`fixtures/`](fixtures/).

## Verified three-source chain

1. OpenAlex work [`W4304757292`](https://openalex.org/W4304757292) resolves from PMID `36223105` and DOI `10.1001/jamacardio.2022.3345`.
2. Its current `awards[0].funder_award_id` is `R01HL136679`. The NIH RePORTER publication search for PMID `36223105` also returns core project `R01HL136679`, application `10229386`. This is agreement between an award identifier path and an independent publication lookup.
3. NIH RePORTER project search for `R01HL136679` returns five project-year records: FY2017–FY2021. For example, application `10229386`, project number `5R01HL136679-05`, FY2021, has an award amount of USD 693,790.
4. ClinicalTrials.gov study [`NCT01206062`](https://clinicaltrials.gov/study/NCT01206062) explicitly includes PMID `36223105` in `protocolSection.referencesModule.references` with type `DERIVED`.

This proves an explicit OpenAlex work ↔ registered study link and a separate explicit work ↔ NIH project link for the same publication. It does **not** claim the RePORTER amount funded that paper, or that the publication caused the trial. The SPRINT trial began before this 2022 secondary analysis; directionality is faithfully represented as a publication reference association.

## Current endpoint probes

- `GET https://api.openalex.org/works/pmid:36223105`
- `POST https://api.reporter.nih.gov/v2/publications/search` with `criteria.pmids=[36223105]`
- `POST https://api.reporter.nih.gov/v2/projects/search` with `criteria.project_nums=["R01HL136679"]`
- `GET https://clinicaltrials.gov/api/v2/studies/NCT01206062`
- `GET https://clinicaltrials.gov/api/v2/studies?query.term=AREA%5BReferencePMID%5D36223105&pageSize=10&format=json`

## Unsupported and incomplete paths

- OpenAlex award `HHSN268200900040C` is preserved but classified as unsupported by the conservative NIH core-project normalizer. It is not silently coerced.
- Work records without awards remain valid and simply produce no grant traversal.
- Candidate joins based on sponsor, institution, condition, or intervention are disabled by default and never become verified edges.
