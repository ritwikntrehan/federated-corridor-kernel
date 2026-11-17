import { BoundaryNames, GrantAwardRefSchema, type GrantAwardRef, type ProjectFundingRef } from '../contracts';
import { makeEnvelope, type Corridor, type CorridorContext } from '../kernel';
import { ReporterAdapter } from '../adapters/reporter';

export const openAlexReporterCorridor: Corridor<GrantAwardRef, ProjectFundingRef[]> = {
  id: 'openalex-to-nih-reporter', title: 'OpenAlex award → NIH RePORTER project-year records', inputBoundary: BoundaryNames.grant, outputBoundary: BoundaryNames.funding,
  matchMethods: ['verified_award', 'exact_pmid'], sideEffects: 'none', limits: { maxInput: 1, maxOutput: 50, timeoutMs: 15000, requestsPerSecond: 1 },
  async traverse(value, context: CorridorContext) {
    const started = Date.now(); const parsed = GrantAwardRefSchema.safeParse(value);
    if (!parsed.success) return makeEnvelope({ payload: [], status: 'failed', passport: { origin_country: 'openalex', source_identifier: 'invalid', source_url: 'https://openalex.org', retrieved_at: context.now().toISOString(), hops: [] },
      customs: { boundary_schema: BoundaryNames.grant, status: 'fail', accepted_count: 0, rejected_count: 1, normalization_notes: [], mismatch_reasons: parsed.error.issues.map((i) => i.message) },
      errors: [{ code: 'CUSTOMS_REJECTION', message: 'GrantAwardRef failed validation', retryable: false }] });
    const input = parsed.data; const adapter = new ReporterAdapter(context.fetch, context.cache);
    try {
      const result = await adapter.findProjects(input.original_funder_award_id);
      const payload = result.records.map((r) => adapter.project(r));
      const supported = result.normalized.supported; const sourceNode = `award:${input.source_work_id}:${input.original_funder_award_id}`;
      const nodes = [{ id: sourceNode, country: 'openalex', type: 'grant-award', label: input.original_funder_award_id, state: (payload.length ? 'verified' : 'unmatched') as 'verified' | 'unmatched', source_uri: input.source_work_id, record_id: input.original_funder_award_id, boundary: input },
        ...payload.map((p) => ({ id: `reporter:${p.application_id}`, country: 'nih-reporter', type: 'project-year', label: `${p.core_project_id} · FY${p.fiscal_year}`, state: 'verified' as const, source_uri: p.source_url, record_id: p.application_id!, boundary: p }))];
      const edges = payload.map((p) => ({ id: `edge:${sourceNode}:${p.application_id}`, from: sourceNode, to: `reporter:${p.application_id}`, corridor_id: 'openalex-to-nih-reporter', state: 'verified' as const,
        match_method: 'verified_award' as const, supporting_uris: [input.source_work_id, p.source_url], supporting_record_ids: [input.original_funder_award_id, p.project_number],
        explanation: `The preserved OpenAlex award identifier normalizes to the exact RePORTER core project ${p.core_project_id}. Amount is the FY${p.fiscal_year} project-record award amount, not paper funding.` }));
      const status = payload.length ? 'complete' : supported ? 'partial' : 'failed';
      return makeEnvelope({ payload, status, passport: { origin_country: 'openalex', source_identifier: input.source_work_id, source_url: input.source_work_id, retrieved_at: context.now().toISOString(),
        hops: [{ from_country: 'openalex', to_country: 'nih-reporter', corridor_id: 'openalex-to-nih-reporter', request: { method: 'POST', url: result.url, cache_status: result.cache }, duration_ms: Date.now() - started, timestamp: context.now().toISOString() }] },
        customs: { boundary_schema: BoundaryNames.grant, status: 'pass', accepted_count: 1, rejected_count: 0, normalization_notes: result.normalized.notes, mismatch_reasons: payload.length ? [] : [supported ? 'No exact core-project records returned.' : 'Unsupported/non-NIH award format.'] },
        interpreter: [{ source_field_path: 'results[].award_amount', canonical_name: 'amount', unit: 'USD', semantics: 'Award amount attached to one RePORTER project record and fiscal year.', transformation_version: 'reporter-project@0.1' },
          { source_field_path: 'results[].core_project_num', canonical_name: 'core_project_id', semantics: 'NIH core project identifier; application and support-year components are not silently merged.', transformation_version: 'reporter-project@0.1' }],
        evidence: { nodes, edges }, errors: payload.length ? [] : [{ code: supported ? 'NO_MATCH' : 'UNSUPPORTED_AWARD', message: supported ? 'No exact NIH project match.' : 'Award is not a conservatively recognized NIH project number.', retryable: false }] });
    } catch (error) {
      return makeEnvelope({ payload: [], status: 'failed', passport: { origin_country: 'openalex', source_identifier: input.source_work_id, source_url: input.source_work_id, retrieved_at: context.now().toISOString(), hops: [] },
        customs: { boundary_schema: BoundaryNames.grant, status: 'pass', accepted_count: 1, rejected_count: 0, normalization_notes: [], mismatch_reasons: ['Provider request failed.'] },
        errors: [{ code: 'PROVIDER_FAILURE', message: error instanceof Error ? error.message : String(error), provider: 'nih-reporter', retryable: true }] });
    }
  }
};
