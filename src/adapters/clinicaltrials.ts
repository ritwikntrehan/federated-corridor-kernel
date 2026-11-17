import { z } from 'zod';
import { BoundaryNames, TrialRegistryRefSchema, type TrialRegistryRef } from '../contracts';
import { cachedJson, type CacheLike, type Fetcher } from '../kernel';

const ReferenceSchema = z.object({ pmid: z.string().optional(), type: z.string().optional(), citation: z.string().optional() }).passthrough();
export const StudySchema = z.object({
  protocolSection: z.object({
    identificationModule: z.object({ nctId: z.string(), briefTitle: z.string().optional() }).passthrough(),
    statusModule: z.object({ overallStatus: z.string() }).passthrough(),
    designModule: z.object({ phases: z.array(z.string()).optional() }).passthrough().optional(),
    sponsorCollaboratorsModule: z.object({ leadSponsor: z.object({ name: z.string() }).passthrough() }).passthrough().optional(),
    conditionsModule: z.object({ conditions: z.array(z.string()).optional() }).passthrough().optional(),
    armsInterventionsModule: z.object({ interventions: z.array(z.object({ name: z.string() }).passthrough()).optional() }).passthrough().optional(),
    referencesModule: z.object({ references: z.array(ReferenceSchema).optional() }).passthrough().optional()
  }).passthrough(), hasResults: z.boolean().optional()
}).passthrough();
export type ClinicalStudy = z.infer<typeof StudySchema>;

export function references(study: ClinicalStudy) { return study.protocolSection.referencesModule?.references ?? []; }
export class ClinicalTrialsAdapter {
  readonly country = 'clinicaltrials.gov';
  constructor(private readonly fetcher: Fetcher, private readonly cache: CacheLike) {}
  private async get(url: URL) {
    return cachedJson(this.cache, `ctg:${url}`, 1800, async () => { const r = await this.fetcher(url); if (!r.ok) throw new Error(`ClinicalTrials.gov ${r.status}`); return r.json(); });
  }
  async getStudy(nctId: string) {
    const id = nctId.toUpperCase(); if (!/^NCT\d{8}$/.test(id)) throw new Error('invalid NCT ID');
    const url = new URL(`https://clinicaltrials.gov/api/v2/studies/${id}`); const { data, cache } = await this.get(url);
    return { record: StudySchema.parse(data), cache, url: url.toString() };
  }
  async findByPublication(input: { pmid?: string; doi?: string }, limit = 10) {
    const term = input.pmid ? `AREA[ReferencePMID]${input.pmid}` : input.doi ? `AREA[ReferenceDOI]${input.doi}` : undefined;
    if (!term) return { records: [] as ClinicalStudy[], cache: 'bypass' as const, url: 'https://clinicaltrials.gov/api/v2/studies' };
    const url = new URL('https://clinicaltrials.gov/api/v2/studies'); url.searchParams.set('query.term', term); url.searchParams.set('pageSize', String(Math.min(limit, 25))); url.searchParams.set('format', 'json');
    const { data, cache } = await this.get(url); return { records: z.object({ studies: z.array(StudySchema) }).parse(data).studies, cache, url: url.toString() };
  }
  project(study: ClinicalStudy, match: { method: 'exact_nct' | 'exact_pmid' | 'exact_doi'; id?: string }, now = new Date()): TrialRegistryRef {
    const refs = references(study); const pmids = refs.flatMap((r) => r.pmid ? [r.pmid] : []);
    const dois = refs.flatMap((r) => r.citation?.match(/doi:\s*([^\s.]+(?:\.[^\s.]+)*)/i)?.[1] ? [r.citation.match(/doi:\s*([^\s]+)/i)![1]!.replace(/[.]$/, '')] : []);
    const p = study.protocolSection;
    return TrialRegistryRefSchema.parse({ boundary_type: BoundaryNames.trial, nct_id: p.identificationModule.nctId, matching_publication_ids: { pmids, dois }, match_state: 'verified', match_method: match.method, confidence: 1,
      status: p.statusModule.overallStatus, phases: p.designModule?.phases ?? [], sponsor: p.sponsorCollaboratorsModule?.leadSponsor.name, conditions: p.conditionsModule?.conditions ?? [],
      interventions: p.armsInterventionsModule?.interventions?.map((i) => i.name) ?? [], source_url: `https://clinicaltrials.gov/study/${p.identificationModule.nctId}`, as_of: now.toISOString() });
  }
}
