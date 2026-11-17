import { z } from 'zod';
import { BoundaryNames, GrantAwardRefSchema, ScholarlyWorkRefSchema, type GrantAwardRef, type ScholarlyWorkRef } from '../contracts';
import { cachedJson, type CacheLike, type Fetcher } from '../kernel';

const AwardSchema = z.object({
  id: z.string().nullable().optional(), display_name: z.string().nullable().optional(), funder_award_id: z.string().nullable().optional(),
  funder_id: z.string().nullable().optional(), funder_display_name: z.string().nullable().optional()
}).passthrough();
export const OpenAlexWorkSchema = z.object({
  id: z.string(), title: z.string(), publication_date: z.string().nullable().optional(), doi: z.string().nullable().optional(),
  publication_year: z.number().nullable().optional(), cited_by_count: z.number().int().nonnegative().optional(),
  counts_by_year: z.array(z.object({ year: z.number().int(), cited_by_count: z.number().int().nonnegative() }).passthrough()).optional(),
  authorships: z.array(z.object({ institutions: z.array(z.object({ ror: z.string().nullable().optional() }).passthrough()).optional() }).passthrough()).optional(),
  ids: z.object({ openalex: z.string(), doi: z.string().nullable().optional(), pmid: z.string().nullable().optional() }).passthrough(),
  awards: z.array(AwardSchema).nullable().optional(), funders: z.array(z.unknown()).nullable().optional()
}).passthrough();
export type OpenAlexWork = z.infer<typeof OpenAlexWorkSchema>;

function bareId(value: string) { return value.replace(/^https:\/\/openalex\.org\//, ''); }
function barePmid(value?: string | null) { return value?.match(/(\d+)\/?$/)?.[1]; }
function bareDoi(value?: string | null) { return value?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, ''); }

export class OpenAlexAdapter {
  readonly country = 'openalex';
  constructor(private readonly fetcher: Fetcher, private readonly cache: CacheLike, private readonly apiKey?: string) {}
  private url(path: string) { const url = new URL(`https://api.openalex.org/${path}`); if (this.apiKey) url.searchParams.set('api_key', this.apiKey); return url; }
  private async get(url: URL) {
    const key = `openalex:${url}`;
    return cachedJson(this.cache, key, 3600, async () => {
      const response = await this.fetcher(url, { headers: { 'User-Agent': 'federated-corridor-kernel/0.1 (mailto:owner@example.invalid)' } });
      if (!response.ok) throw new Error(`OpenAlex ${response.status}`);
      return response.json();
    });
  }
  async discoverWorks(query: string, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 25);
    const url = this.url('works'); url.searchParams.set('search', query); url.searchParams.set('per-page', String(safeLimit));
    const { data, cache } = await this.get(url);
    const parsed = z.object({ results: z.array(OpenAlexWorkSchema) }).parse(data);
    return { records: parsed.results, cache, url: url.toString() };
  }
  async getWorkByIdOrPmid(id: string) {
    const normalized = /^\d+$/.test(id) ? `pmid:${id}` : /^(https?:\/\/)?(dx\.)?doi\.org\//i.test(id) ? `doi:${bareDoi(id)}` : id.includes('/') && !id.includes('openalex.org') ? `doi:${bareDoi(id)}` : bareId(id);
    const url = this.url(`works/${encodeURIComponent(normalized)}`);
    const { data, cache } = await this.get(url);
    return { record: OpenAlexWorkSchema.parse(data), cache, url: url.toString() };
  }
  async discoverCohort(filter: { topic?: string; institutionRor?: string }, limit = 15, offset = 0) {
    const safeLimit = Math.min(Math.max(limit, 1), 25); const url = this.url('works');
    if (filter.topic) url.searchParams.set('search', filter.topic);
    if (filter.institutionRor) url.searchParams.set('filter', `institutions.ror:${filter.institutionRor}`);
    url.searchParams.set('per-page', String(safeLimit)); url.searchParams.set('page', String(Math.floor(offset / safeLimit) + 1)); url.searchParams.set('sort', 'id:asc');
    const { data, cache } = await this.get(url); const parsed = z.object({ results: z.array(OpenAlexWorkSchema), meta: z.object({ count: z.number().optional() }).passthrough().optional() }).parse(data);
    return { records: parsed.results, total: parsed.meta?.count ?? parsed.results.length, cache, url: url.toString() };
  }
  projectWork(record: OpenAlexWork): ScholarlyWorkRef {
    const rors = [...new Set((record.authorships ?? []).flatMap((a) => (a.institutions ?? []).flatMap((i) => i.ror ? [i.ror] : [])))];
    return ScholarlyWorkRefSchema.parse({ boundary_type: BoundaryNames.work, openalex_id: record.id, doi: bareDoi(record.doi ?? record.ids.doi), pmid: barePmid(record.ids.pmid), title: record.title,
      ...(record.cited_by_count !== undefined ? { cited_by_count: record.cited_by_count } : {}), ...(record.counts_by_year ? { counts_by_year: record.counts_by_year } : {}),
      ...(record.publication_year ? { publication_year: record.publication_year } : {}), ...(rors.length ? { author_institution_rors: rors } : {}),
      ...(record.publication_date ? { publication_date: record.publication_date } : {}), source_url: record.id });
  }
  projectAwards(record: OpenAlexWork): GrantAwardRef[] {
    return (record.awards ?? []).flatMap((award, index) => {
      if (!award.funder_award_id) return [];
      const raw = award.funder_award_id;
      const compact = raw.toUpperCase().replace(/\s+/g, '');
      return [GrantAwardRefSchema.parse({ boundary_type: BoundaryNames.grant, original_funder_award_id: raw, normal_form_candidates: [...new Set([raw, compact])],
        ...(award.funder_id ? { funder_id: award.funder_id } : {}), ...(award.funder_display_name ? { funder_name: award.funder_display_name } : {}),
        source_work_id: record.id, source_evidence_path: `awards[${index}].funder_award_id` })];
    });
  }
}
