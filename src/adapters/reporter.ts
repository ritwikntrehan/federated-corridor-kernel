import { z } from 'zod';
import { BoundaryNames, ProjectFundingRefSchema, type ProjectFundingRef } from '../contracts';
import { cachedJson, type CacheLike, type Fetcher } from '../kernel';

export interface NormalizedProjectNumber { raw: string; candidates: string[]; core?: string; notes: string[]; supported: boolean; }
export function normalizeProjectNumber(raw: string): NormalizedProjectNumber {
  const notes: string[] = ['Preserved verbatim funder award identifier.'];
  const compact = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (compact !== raw) notes.push('Trimmed whitespace and uppercased for a search candidate.');
  const match = compact.match(/^\d?((?:[A-Z]\d{2}|[A-Z]{2}\d)[A-Z]{2}\d{6})(?:-\d{2}(?:[A-Z]\d?)?)?$/);
  if (!match?.[1]) return { raw, candidates: [...new Set([raw, compact])], notes: [...notes, 'Identifier did not match the conservative NIH core-project pattern.'], supported: false };
  const core = match[1];
  if (core !== compact) notes.push(`Extracted NIH core project candidate ${core}; application/support-year suffix remains available in the raw value.`);
  return { raw, candidates: [...new Set([raw, compact, core])], core, notes, supported: true };
}

const ProjectSchema = z.object({ appl_id: z.number(), project_num: z.string(), core_project_num: z.string(), fiscal_year: z.number(), award_amount: z.number().nullable(), agency_code: z.string().nullable().optional() }).passthrough();
const PublicationSchema = z.object({ coreproject: z.string(), pmid: z.number(), applid: z.number() }).passthrough();
export type ReporterProject = z.infer<typeof ProjectSchema>;

export class ReporterAdapter {
  readonly country = 'nih-reporter';
  private nextRequestAt = 0;
  constructor(private readonly fetcher: Fetcher, private readonly cache: CacheLike) {}
  private async post(path: string, body: unknown, ttl = 3600) {
    const key = `reporter:${path}:${JSON.stringify(body)}`;
    return cachedJson(this.cache, key, ttl, async () => {
      const delay = Math.max(0, this.nextRequestAt - Date.now());
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      this.nextRequestAt = Date.now() + 1000;
      const response = await this.fetcher(`https://api.reporter.nih.gov/v2/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(`NIH RePORTER ${response.status}`);
      return response.json();
    });
  }
  async findProjects(projectNumber: string, limit = 25) {
    const normalized = normalizeProjectNumber(projectNumber);
    if (!normalized.supported || !normalized.core) return { records: [] as ReporterProject[], normalized, cache: 'bypass' as const, url: 'https://api.reporter.nih.gov/v2/projects/search' };
    const body = { criteria: { project_nums: [normalized.core] }, include_fields: ['ApplId', 'ProjectNum', 'CoreProjectNum', 'FiscalYear', 'AwardAmount', 'AgencyCode', 'ProjectTitle', 'Organization', 'PrincipalInvestigators'], offset: 0, limit: Math.min(limit, 50), sort_field: 'fiscal_year', sort_order: 'desc' };
    const { data, cache } = await this.post('projects/search', body);
    const parsed = z.object({ results: z.array(ProjectSchema) }).parse(data);
    const exact = parsed.results.filter((p) => p.core_project_num.toUpperCase() === normalized.core);
    return { records: exact, normalized, cache, url: 'https://api.reporter.nih.gov/v2/projects/search' };
  }
  async findPublications(criteria: { pmids?: number[]; coreProjectNums?: string[] }, limit = 25) {
    const body = { criteria: { ...(criteria.pmids ? { pmids: criteria.pmids } : {}), ...(criteria.coreProjectNums ? { core_project_nums: criteria.coreProjectNums } : {}) },
      include_fields: ['Pmid', 'CoreProjectNum', 'ProjectNum', 'Title', 'Authors'], offset: 0, limit: Math.min(limit, 50) };
    const { data, cache } = await this.post('publications/search', body);
    return { records: z.object({ results: z.array(PublicationSchema) }).parse(data).results, cache, url: 'https://api.reporter.nih.gov/v2/publications/search' };
  }
  project(record: ReporterProject): ProjectFundingRef {
    return ProjectFundingRefSchema.parse({ boundary_type: BoundaryNames.funding, core_project_id: record.core_project_num, application_id: String(record.appl_id), project_number: record.project_num,
      fiscal_year: record.fiscal_year, amount: record.award_amount, currency: 'USD', amount_semantics: 'NIH RePORTER award amount for this project record and fiscal year; not funding paid to produce a specific publication.',
      agency: record.agency_code ?? 'NIH', source_url: `https://reporter.nih.gov/project-details/${record.appl_id}` });
  }
}
