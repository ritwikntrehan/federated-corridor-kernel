import { BoundaryNames, ScholarlyWorkRefSchema, type ScholarlyWorkRef, type TrialRegistryRef } from '../contracts';
import { ClinicalTrialsAdapter, references } from '../adapters/clinicaltrials';
import { makeEnvelope, type Corridor, type CorridorContext } from '../kernel';

export const openAlexClinicalTrialsCorridor: Corridor<ScholarlyWorkRef, TrialRegistryRef[]> = {
  id: 'openalex-to-clinical-trials', title: 'OpenAlex work ↔ ClinicalTrials.gov referenced publication', inputBoundary: BoundaryNames.work, outputBoundary: BoundaryNames.trial,
  matchMethods: ['exact_pmid', 'exact_doi'], sideEffects: 'none', limits: { maxInput: 1, maxOutput: 10, timeoutMs: 12000 },
  async traverse(value, context) {
    const started = Date.now(); const parsed = ScholarlyWorkRefSchema.safeParse(value);
    if (!parsed.success) return makeEnvelope({ payload: [], status: 'failed', passport: { origin_country: 'openalex', source_identifier: 'invalid', source_url: 'https://openalex.org', retrieved_at: context.now().toISOString(), hops: [] },
      customs: { boundary_schema: BoundaryNames.work, status: 'fail', accepted_count: 0, rejected_count: 1, normalization_notes: [], mismatch_reasons: parsed.error.issues.map((i) => i.message) }, errors: [{ code: 'CUSTOMS_REJECTION', message: 'ScholarlyWorkRef failed validation', retryable: false }] });
    const input = parsed.data; const adapter = new ClinicalTrialsAdapter(context.fetch, context.cache);
    try {
      const result = await adapter.findByPublication(input.pmid ? { pmid: input.pmid } : { doi: input.doi! });
      const method = input.pmid ? 'exact_pmid' as const : 'exact_doi' as const;
      const exact = result.records.filter((study) => method === 'exact_pmid'
        ? references(study).some((r) => r.pmid === input.pmid)
        : references(study).some((r) => r.citation?.toLowerCase().includes(input.doi!.toLowerCase())));
      const payload = exact.map((s) => adapter.project(s, { method }, context.now())); const workNode = `openalex:${input.openalex_id.replace(/^.*\//, '')}`;
      const nodes = [{ id: workNode, country: 'openalex', type: 'scholarly-work', label: input.title ?? input.openalex_id, state: 'verified' as const, source_uri: input.source_url, record_id: input.openalex_id, boundary: input },
        ...payload.map((t) => ({ id: `ctg:${t.nct_id}`, country: 'clinicaltrials.gov', type: 'registered-study', label: `${t.nct_id} · ${t.status ?? 'status unavailable'}`, state: 'verified' as const, source_uri: t.source_url, record_id: t.nct_id, boundary: t }))];
      const edges = payload.map((t) => ({ id: `edge:${workNode}:${t.nct_id}`, from: workNode, to: `ctg:${t.nct_id}`, corridor_id: 'openalex-to-clinical-trials', state: 'verified' as const, match_method: method,
        supporting_uris: [input.source_url, t.source_url], supporting_record_ids: [method === 'exact_pmid' ? input.pmid! : input.doi!, t.nct_id], explanation: `ClinicalTrials.gov explicitly references the work's ${method === 'exact_pmid' ? 'PMID' : 'DOI'}; topic or sponsor similarity was not used.` }));
      return makeEnvelope({ payload, status: payload.length ? 'complete' : 'partial', passport: { origin_country: 'openalex', source_identifier: input.openalex_id, source_url: input.source_url, retrieved_at: context.now().toISOString(),
        hops: [{ from_country: 'openalex', to_country: 'clinicaltrials.gov', corridor_id: 'openalex-to-clinical-trials', request: { method: 'GET', url: result.url, cache_status: result.cache }, duration_ms: Date.now() - started, timestamp: context.now().toISOString() }] },
        customs: { boundary_schema: BoundaryNames.work, status: 'pass', accepted_count: 1, rejected_count: 0, normalization_notes: ['Exact reference identifiers only; candidate similarity is disabled.'], mismatch_reasons: payload.length ? [] : ['No trial record contained the exact publication identifier.'] },
        interpreter: [{ source_field_path: 'protocolSection.referencesModule.references[].pmid', canonical_name: 'matching_publication_ids.pmids', semantics: 'Verbatim publication PMID exposed by ClinicalTrials.gov.', transformation_version: 'ctg-study@0.1' },
          { source_field_path: 'protocolSection.designModule.phases', canonical_name: 'phases', semantics: 'Source phase list preserved; NA and missing are not reinterpreted.', transformation_version: 'ctg-study@0.1' }], evidence: { nodes, edges },
        errors: payload.length ? [] : [{ code: 'NO_MATCH', message: 'No exact ClinicalTrials.gov publication reference match.', retryable: false }] });
    } catch (error) {
      return makeEnvelope({ payload: [], status: 'failed', passport: { origin_country: 'openalex', source_identifier: input.openalex_id, source_url: input.source_url, retrieved_at: context.now().toISOString(), hops: [] },
        customs: { boundary_schema: BoundaryNames.work, status: 'pass', accepted_count: 1, rejected_count: 0, normalization_notes: [], mismatch_reasons: ['Provider request failed.'] }, errors: [{ code: 'PROVIDER_FAILURE', message: error instanceof Error ? error.message : String(error), provider: 'clinicaltrials.gov', retryable: true }] });
    }
  }
};
