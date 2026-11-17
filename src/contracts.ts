import { z } from 'zod';

export const BoundaryNames = {
  work: 'ScholarlyWorkRef@0.1',
  grant: 'GrantAwardRef@0.1',
  funding: 'ProjectFundingRef@0.1',
  trial: 'TrialRegistryRef@0.1'
} as const;

const httpUrl = z.string().url().refine((v) => /^https?:/.test(v), 'must be HTTP(S)');
const nonEmpty = z.string().trim().min(1);

export const ScholarlyWorkRefSchema = z.object({
  boundary_type: z.literal(BoundaryNames.work),
  openalex_id: z.string().regex(/^(https:\/\/openalex\.org\/)?W\d+$/),
  doi: z.string().min(3).optional(),
  pmid: z.string().regex(/^\d+$/).optional(),
  title: nonEmpty.optional(),
  cited_by_count: z.number().int().nonnegative().optional(),
  counts_by_year: z.array(z.object({ year: z.number().int(), cited_by_count: z.number().int().nonnegative() })).optional(),
  publication_year: z.number().int().min(1600).max(2200).optional(),
  author_institution_rors: z.array(httpUrl).optional(),
  publication_date: z.string().date().optional(),
  source_url: httpUrl
}).refine((v) => Boolean(v.doi || v.pmid), 'DOI or PMID is required');

export const GrantAwardRefSchema = z.object({
  boundary_type: z.literal(BoundaryNames.grant),
  original_funder_award_id: nonEmpty,
  normal_form_candidates: z.array(nonEmpty).min(1),
  funder_id: nonEmpty.optional(),
  funder_name: nonEmpty.optional(),
  source_work_id: nonEmpty,
  source_evidence_path: nonEmpty
});

export const ProjectFundingRefSchema = z.object({
  boundary_type: z.literal(BoundaryNames.funding),
  core_project_id: nonEmpty,
  application_id: z.string().regex(/^\d+$/).optional(),
  project_number: nonEmpty,
  fiscal_year: z.number().int().min(1900).max(2200),
  amount: z.number().finite().nonnegative().nullable(),
  direct_cost_amount: z.number().finite().nonnegative().nullable().optional(),
  indirect_cost_amount: z.number().finite().nonnegative().nullable().optional(),
  currency: z.literal('USD'),
  amount_semantics: z.literal('NIH RePORTER award amount for this project record and fiscal year; not funding paid to produce a specific publication.'),
  agency: nonEmpty,
  study_section: z.object({ code: nonEmpty.optional(), flex: nonEmpty.optional() }).optional(),
  organization: z.object({ name: nonEmpty.optional(), uei: nonEmpty.optional(), fips: nonEmpty.optional() }).optional(),
  principal_investigators: z.array(z.object({ id: nonEmpty.optional(), name: nonEmpty })).optional(),
  project_start_date: nonEmpty.optional(),
  project_end_date: nonEmpty.optional(),
  source_url: httpUrl
});

export const TrialRegistryRefSchema = z.object({
  boundary_type: z.literal(BoundaryNames.trial),
  nct_id: z.string().regex(/^NCT\d{8}$/),
  matching_publication_ids: z.object({
    pmids: z.array(z.string().regex(/^\d+$/)),
    dois: z.array(nonEmpty)
  }),
  match_state: z.enum(['verified', 'candidate', 'unmatched']),
  match_method: z.enum(['exact_nct', 'exact_pmid', 'exact_doi', 'candidate_similarity']),
  confidence: z.number().min(0).max(1),
  status: nonEmpty.optional(),
  why_stopped: nonEmpty.optional(),
  enrollment: z.object({ count: z.number().int().nonnegative(), type: nonEmpty.optional() }).optional(),
  lead_sponsor: z.object({ name: nonEmpty, class: nonEmpty.optional() }).optional(),
  primary_outcomes: z.array(z.object({ measure: nonEmpty, description: z.string().optional(), time_frame: z.string().optional() })).optional(),
  study_type: nonEmpty.optional(),
  study_dates: z.object({ start: nonEmpty.optional(), primary_completion: nonEmpty.optional(), completion: nonEmpty.optional() }).optional(),
  phases: z.array(nonEmpty),
  sponsor: nonEmpty.optional(),
  conditions: z.array(nonEmpty),
  interventions: z.array(nonEmpty),
  source_url: httpUrl,
  as_of: z.string().datetime()
}).superRefine((v, ctx) => {
  if (v.match_state === 'verified' && !['exact_nct', 'exact_pmid', 'exact_doi'].includes(v.match_method)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'verified trials require an exact identifier match' });
  }
});

export const BoundarySchemas = {
  [BoundaryNames.work]: ScholarlyWorkRefSchema,
  [BoundaryNames.grant]: GrantAwardRefSchema,
  [BoundaryNames.funding]: ProjectFundingRefSchema,
  [BoundaryNames.trial]: TrialRegistryRefSchema
} as const;

export type BoundaryName = keyof typeof BoundarySchemas;
export type ScholarlyWorkRef = z.infer<typeof ScholarlyWorkRefSchema>;
export type GrantAwardRef = z.infer<typeof GrantAwardRefSchema>;
export type ProjectFundingRef = z.infer<typeof ProjectFundingRefSchema>;
export type TrialRegistryRef = z.infer<typeof TrialRegistryRefSchema>;

export const HopSchema = z.object({
  from_country: nonEmpty,
  to_country: nonEmpty,
  corridor_id: nonEmpty,
  request: z.object({ method: nonEmpty, url: httpUrl, cache_status: z.enum(['hit', 'miss', 'bypass']).optional() }),
  duration_ms: z.number().nonnegative(),
  timestamp: z.string().datetime()
});

export const PassportSchema = z.object({
  origin_country: nonEmpty,
  source_identifier: nonEmpty,
  source_url: httpUrl,
  retrieved_at: z.string().datetime(),
  source_terms: z.string().optional(),
  license: z.string().optional(),
  hops: z.array(HopSchema)
});

export const CustomsSchema = z.object({
  boundary_schema: nonEmpty,
  status: z.enum(['pass', 'fail']),
  accepted_count: z.number().int().nonnegative(),
  rejected_count: z.number().int().nonnegative(),
  normalization_notes: z.array(z.string()),
  mismatch_reasons: z.array(z.string())
});

export const InterpreterMappingSchema = z.object({
  source_field_path: nonEmpty,
  canonical_name: nonEmpty,
  unit: z.string().optional(),
  semantics: nonEmpty,
  null_semantics: z.string().optional(),
  transformation_version: nonEmpty
});

export const EvidenceNodeSchema = z.object({
  id: nonEmpty,
  country: nonEmpty,
  type: nonEmpty,
  label: nonEmpty,
  state: z.enum(['verified', 'candidate', 'unmatched', 'failed']),
  source_uri: httpUrl,
  record_id: nonEmpty,
  boundary: z.unknown().optional(),
  raw_record: z.unknown().optional()
});

export const EvidenceEdgeSchema = z.object({
  id: nonEmpty,
  from: nonEmpty,
  to: nonEmpty,
  corridor_id: nonEmpty,
  state: z.enum(['verified', 'candidate', 'unmatched', 'failed']),
  evidence_tier: z.enum(['verified', 'hypothesis']).optional(),
  match_method: z.enum(['exact_nct', 'exact_pmid', 'exact_doi', 'verified_award', 'candidate_similarity', 'none', 'provider_failure']),
  supporting_uris: z.array(httpUrl).min(1),
  supporting_record_ids: z.array(nonEmpty).min(1),
  explanation: nonEmpty,
  match_basis: z.array(nonEmpty).optional(),
  compared_fields: z.array(nonEmpty).optional(),
  heuristic_score: z.number().min(0).max(1).optional(),
  qualitative_strength: z.enum(['weak', 'moderate', 'strong']).optional()
}).superRefine((edge, ctx) => {
  const tier = edge.evidence_tier ?? (edge.state === 'candidate' ? 'hypothesis' : 'verified');
  if (tier === 'hypothesis' && (!edge.match_basis?.length || !edge.compared_fields?.length || (edge.heuristic_score === undefined && edge.qualitative_strength === undefined))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'hypothesis edges require match_basis, compared_fields, and an uncalibrated score or strength' });
  }
  if (edge.state === 'verified' && tier !== 'verified') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'verified edges require verified evidence tier' });
});

export const EvidenceSchema = z.object({ nodes: z.array(EvidenceNodeSchema), edges: z.array(EvidenceEdgeSchema) }).superRefine((g, ctx) => {
  const ids = new Set(g.nodes.map((n) => n.id));
  for (const edge of g.edges) if (!ids.has(edge.from) || !ids.has(edge.to)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `edge ${edge.id} references a missing node` });
  }
});

export const DiplomaticEnvelopeSchema = z.object({
  schema_version: z.literal('0.1'),
  envelope_id: z.string().uuid(),
  status: z.enum(['complete', 'partial', 'failed']),
  payload: z.unknown(),
  passport: PassportSchema,
  customs_declaration: CustomsSchema,
  resident_interpreter: z.array(InterpreterMappingSchema),
  evidence: EvidenceSchema,
  errors: z.array(z.object({ code: nonEmpty, message: nonEmpty, provider: z.string().optional(), retryable: z.boolean() }))
});

export type DiplomaticEnvelope<T = unknown> = Omit<z.infer<typeof DiplomaticEnvelopeSchema>, 'payload'> & { payload: T };
export type EvidenceGraph = z.infer<typeof EvidenceSchema>;
export type EvidenceNode = z.infer<typeof EvidenceNodeSchema>;

export const CohortQuerySchema = z.object({
  origin_country: z.enum(['clinicaltrials.gov', 'nih-reporter', 'openalex']),
  seed_filter: z.object({
    domain: nonEmpty.optional(), status: nonEmpty.optional(), phase: nonEmpty.optional(), study_type: nonEmpty.optional(),
    fiscal_year_from: z.number().int().min(1985).max(2200).optional(), fiscal_year_to: z.number().int().min(1985).max(2200).optional(),
    activity_codes: z.array(z.enum(['R01', 'U01'])).optional(), topic: nonEmpty.optional(), institution_ror: httpUrl.optional()
  }).strict(),
  max_seeds: z.number().int().min(1).max(25).default(15),
  corridors: z.array(z.enum(['clinicaltrials-to-openalex', 'openalex-to-nih-reporter', 'openalex-to-clinical-trials'])).min(1).default(['clinicaltrials-to-openalex', 'openalex-to-nih-reporter']),
  include_hypothesis_edges: z.boolean().default(false),
  continuation: z.object({ seed_offset: z.number().int().nonnegative() }).optional()
}).superRefine((query, ctx) => {
  const f = query.seed_filter;
  if (query.origin_country === 'clinicaltrials.gov' && !(f.domain || f.status || f.phase || f.study_type)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'clinicaltrials.gov cohorts require a constrained trial filter' });
  if (query.origin_country === 'nih-reporter' && !(f.domain && f.fiscal_year_from && f.fiscal_year_to)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'NIH cohorts require domain and fiscal-year bounds' });
  if (query.origin_country === 'openalex' && !(f.topic || f.institution_ror)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'OpenAlex cohorts require topic or institution_ror' });
});
export type CohortQuery = z.infer<typeof CohortQuerySchema>;

const CorridorTelemetrySchema = z.object({ attempts: z.number().int().nonnegative(), verified_edges: z.number().int().nonnegative(), hypothesis_edges: z.number().int().nonnegative(), no_matches: z.number().int().nonnegative(), errors: z.number().int().nonnegative() });
export const CohortTelemetrySchema = z.object({
  seeds_discovered: z.number().int().nonnegative(), seeds_selected: z.number().int().nonnegative(), seeds_attempted: z.number().int().nonnegative(), seeds_completed: z.number().int().nonnegative(),
  unique_boundary_keys_extracted: z.record(z.string(), z.number().int().nonnegative()), corridors: z.record(z.string(), CorridorTelemetrySchema),
  unique_source_nodes: z.number().int().nonnegative(), unique_verified_relationships: z.number().int().nonnegative(), unique_hypothesis_relationships: z.number().int().nonnegative(),
  provider_requests: z.number().int().nonnegative(), cache_hits: z.number().int().nonnegative(), deduplicated_requests: z.number().int().nonnegative(), timeouts: z.number().int().nonnegative(), retries: z.number().int().nonnegative(), partial_budget_stops: z.number().int().nonnegative(),
  drop_off_reasons: z.record(z.string(), z.number().int().nonnegative())
});
export const CohortResultSchema = z.object({
  schema_version: z.literal('0.2'), status: z.enum(['complete', 'partial', 'failed']), query: CohortQuerySchema, selected_seed_ids: z.array(nonEmpty), graph: EvidenceSchema,
  envelopes: z.array(DiplomaticEnvelopeSchema), telemetry: CohortTelemetrySchema, errors: z.array(z.object({ code: nonEmpty, message: nonEmpty, provider: z.string().optional(), seed_id: z.string().optional() })),
  continuation: z.object({ seed_offset: z.number().int().nonnegative() }).nullable(), generated_at: z.string().datetime()
});
export type CohortResult = z.infer<typeof CohortResultSchema>;
