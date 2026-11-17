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
  currency: z.literal('USD'),
  amount_semantics: z.literal('NIH RePORTER award amount for this project record and fiscal year; not funding paid to produce a specific publication.'),
  agency: nonEmpty,
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
  match_method: z.enum(['exact_nct', 'exact_pmid', 'exact_doi', 'verified_award', 'candidate_similarity', 'none', 'provider_failure']),
  supporting_uris: z.array(httpUrl).min(1),
  supporting_record_ids: z.array(nonEmpty).min(1),
  explanation: nonEmpty
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
