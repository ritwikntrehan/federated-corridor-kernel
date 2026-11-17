import { z } from 'zod';
import { BoundaryNames, TrialRegistryRefSchema, type TrialRegistryRef } from '../contracts';
import { cachedJson, type CacheLike, type Fetcher } from '../kernel';

const ReferenceSchema = z.object({ pmid: z.string().optional(), type: z.string().optional(), citation: z.string().optional() }).passthrough();
export const StudySchema = z.object({
  protocolSection: z.object({
    identificationModule: z.object({ nctId: z.string(), briefTitle: z.string().optional() }).passthrough(),
    statusModule: z.object({ overallStatus: z.string(), whyStopped: z.string().optional(), startDateStruct: z.object({ date: z.string() }).passthrough().optional(), primaryCompletionDateStruct: z.object({ date: z.string() }).passthrough().optional(), completionDateStruct: z.object({ date: z.string() }).passthrough().optional() }).passthrough(),
    designModule: z.object({ studyType: z.string().optional(), phases: z.array(z.string()).optional(), enrollmentInfo: z.object({ count: z.number(), type: z.string().optional() }).passthrough().optional() }).passthrough().optional(),
    sponsorCollaboratorsModule: z.object({ leadSponsor: z.object({ name: z.string(), class: z.string().optional() }).passthrough() }).passthrough().optional(),
    conditionsModule: z.object({ conditions: z.array(z.string()).optional() }).passthrough().optional(),
    armsInterventionsModule: z.object({ interventions: z.array(z.object({ name: z.string() }).passthrough()).optional() }).passthrough().optional(),
    outcomesModule: z.object({ primaryOutcomes: z.array(z.object({ measure: z.string(), description: z.string().optional(), timeFrame: z.string().optional() }).passthrough()).optional() }).passthrough().optional(),
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
  async discoverCohort(filter: { domain?: string; status?: string; phase?: string; studyType?: string }, limit = 15, pageToken?: string) {
    const url = new URL('https://clinicaltrials.gov/api/v2/studies');
    if (filter.domain) url.searchParams.set('query.cond', filter.domain);
    if (filter.status) url.searchParams.set('filter.overallStatus', filter.status.toUpperCase());
    const advanced = [filter.phase ? `AREA[Phase]${filter.phase.toUpperCase()}` : '', filter.studyType ? `AREA[StudyType]${filter.studyType.toUpperCase()}` : ''].filter(Boolean).join(' AND ');
    if (advanced) url.searchParams.set('filter.advanced', advanced); url.searchParams.set('pageSize', String(Math.min(limit, 25))); url.searchParams.set('format', 'json'); if (pageToken) url.searchParams.set('pageToken', pageToken);
    const { data, cache } = await this.get(url); const parsed = z.object({ studies: z.array(StudySchema), totalCount: z.number().optional(), nextPageToken: z.string().optional() }).parse(data);
    const records = parsed.studies.filter((s) => (!filter.status || s.protocolSection.statusModule.overallStatus === filter.status.toUpperCase()) && (!filter.phase || s.protocolSection.designModule?.phases?.includes(filter.phase.toUpperCase())) && (!filter.studyType || s.protocolSection.designModule?.studyType === filter.studyType.toUpperCase()));
    return { records, total: parsed.totalCount ?? records.length, nextPageToken: parsed.nextPageToken, cache, url: url.toString() };
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
      status: p.statusModule.overallStatus, ...(p.statusModule.whyStopped ? { why_stopped: p.statusModule.whyStopped } : {}), ...(p.designModule?.enrollmentInfo ? { enrollment: p.designModule.enrollmentInfo } : {}),
      ...(p.sponsorCollaboratorsModule?.leadSponsor ? { lead_sponsor: p.sponsorCollaboratorsModule.leadSponsor } : {}), ...(p.outcomesModule?.primaryOutcomes ? { primary_outcomes: p.outcomesModule.primaryOutcomes.map((o) => ({ measure: o.measure, ...(o.description ? { description: o.description } : {}), ...(o.timeFrame ? { time_frame: o.timeFrame } : {}) })) } : {}),
      ...(p.designModule?.studyType ? { study_type: p.designModule.studyType } : {}), study_dates: { ...(p.statusModule.startDateStruct?.date ? { start: p.statusModule.startDateStruct.date } : {}), ...(p.statusModule.primaryCompletionDateStruct?.date ? { primary_completion: p.statusModule.primaryCompletionDateStruct.date } : {}), ...(p.statusModule.completionDateStruct?.date ? { completion: p.statusModule.completionDateStruct.date } : {}) },
      phases: p.designModule?.phases ?? [], sponsor: p.sponsorCollaboratorsModule?.leadSponsor.name, conditions: p.conditionsModule?.conditions ?? [],
      interventions: p.armsInterventionsModule?.interventions?.map((i) => i.name) ?? [], source_url: `https://clinicaltrials.gov/study/${p.identificationModule.nctId}`, as_of: now.toISOString() });
  }
}
