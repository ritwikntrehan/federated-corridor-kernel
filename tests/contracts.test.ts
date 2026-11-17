import { describe, expect, it } from 'vitest';
import { DiplomaticEnvelopeSchema, EvidenceSchema, GrantAwardRefSchema, ProjectFundingRefSchema, ScholarlyWorkRefSchema, TrialRegistryRefSchema } from '../src/contracts';
import { makeEnvelope } from '../src/kernel';

describe('versioned contracts and customs', () => {
  it('requires work identity and exact schema version', () => {
    expect(ScholarlyWorkRefSchema.safeParse({ boundary_type: 'ScholarlyWorkRef@0.1', openalex_id: 'W1', source_url: 'https://openalex.org/W1' }).success).toBe(false);
    const env = makeEnvelope({ payload: {}, passport: { origin_country: 'test', source_identifier: '1', source_url: 'https://example.test/1', retrieved_at: new Date(0).toISOString(), hops: [] }, customs: { boundary_schema: 'Test@0.1', status: 'pass', accepted_count: 1, rejected_count: 0, normalization_notes: [], mismatch_reasons: [] } });
    expect(DiplomaticEnvelopeSchema.safeParse({ ...env, schema_version: '9.9' }).success).toBe(false);
  });
  it('rejects malformed passports and monetary units', () => {
    expect(DiplomaticEnvelopeSchema.safeParse({ schema_version: '0.1', envelope_id: crypto.randomUUID(), status: 'complete', payload: {}, passport: { origin_country: '', source_identifier: '', source_url: 'javascript:alert(1)', retrieved_at: 'today', hops: [] }, customs_declaration: { boundary_schema: 'x', status: 'pass', accepted_count: 1, rejected_count: 0, normalization_notes: [], mismatch_reasons: [] }, resident_interpreter: [], evidence: { nodes: [], edges: [] }, errors: [] }).success).toBe(false);
    expect(ProjectFundingRefSchema.safeParse({ boundary_type: 'ProjectFundingRef@0.1', core_project_id: 'R01HL136679', project_number: '5R01HL136679-05', fiscal_year: 2021, amount: 1, currency: 'dollars', amount_semantics: 'x', agency: 'NIH', source_url: 'https://example.test' }).success).toBe(false);
  });
  it('preserves raw grant IDs and prevents approximate verified trials', () => {
    expect(GrantAwardRefSchema.parse({ boundary_type: 'GrantAwardRef@0.1', original_funder_award_id: ' 1r01 hl136679-01 ', normal_form_candidates: ['R01HL136679'], source_work_id: 'W1', source_evidence_path: 'awards[0]' }).original_funder_award_id).toContain(' ');
    expect(TrialRegistryRefSchema.safeParse({ boundary_type: 'TrialRegistryRef@0.1', nct_id: 'NCT01206062', matching_publication_ids: { pmids: [], dois: [] }, match_state: 'verified', match_method: 'candidate_similarity', confidence: .8, phases: [], conditions: [], interventions: [], source_url: 'https://clinicaltrials.gov/study/NCT01206062', as_of: new Date().toISOString() }).success).toBe(false);
  });
  it('rejects evidence edges whose nodes do not exist', () => {
    expect(EvidenceSchema.safeParse({ nodes: [], edges: [{ id: 'e', from: 'a', to: 'b', corridor_id: 'c', state: 'verified', match_method: 'exact_pmid', supporting_uris: ['https://example.test'], supporting_record_ids: ['1'], explanation: 'x' }] }).success).toBe(false);
  });
});
