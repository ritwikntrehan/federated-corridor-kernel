import { z } from 'zod';
import { BoundaryNames, FDAProductRefSchema, type FDAProductRef } from '../contracts';
import { cachedJson, type CacheLike, type Fetcher } from '../kernel';

const DrugSchema = z.object({ application_number: z.string(), sponsor_name: z.string().optional(), products: z.array(z.object({ brand_name: z.string().optional(), active_ingredients: z.array(z.object({ name: z.string() })).optional() }).passthrough()).optional(), submissions: z.array(z.object({ submission_status: z.string().optional(), submission_status_date: z.string().optional() }).passthrough()).optional() }).passthrough();
const DeviceSchema = z.object({ k_number: z.string(), applicant: z.string().optional(), device_name: z.string().optional(), decision_date: z.string().optional(), decision_code: z.string().optional() }).passthrough();
const LabelSchema = z.object({ id: z.string().optional(), set_id: z.string().optional(), openfda: z.object({ application_number: z.array(z.string()).optional(), brand_name: z.array(z.string()).optional(), generic_name: z.array(z.string()).optional(), substance_name: z.array(z.string()).optional(), manufacturer_name: z.array(z.string()).optional() }).passthrough().optional() }).passthrough();
type Drug = z.infer<typeof DrugSchema>; type Device = z.infer<typeof DeviceSchema>; type Label = z.infer<typeof LabelSchema>;
export type OpenFdaKind = 'drug_application' | 'drug_label' | 'device_510k';

function nctMentions(value: unknown) { return [...new Set(JSON.stringify(value).match(/NCT\d{8}/gi)?.map((id) => id.toUpperCase()) ?? [])]; }
function compactDate(value?: string) { return value?.match(/^\d{8}$/) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : value; }
export class OpenFdaAdapter {
  readonly country = 'openfda';
  constructor(private readonly fetcher: Fetcher, private readonly cache: CacheLike, private readonly apiKey?: string) {}
  private async request(endpoint: string, search: string, limit = 10) {
    const publicUrl = new URL(`https://api.fda.gov/${endpoint}.json`); publicUrl.searchParams.set('search', search); publicUrl.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 25)));
    const requestUrl = new URL(publicUrl); if (this.apiKey) requestUrl.searchParams.set('api_key', this.apiKey);
    const { data, cache } = await cachedJson<unknown>(this.cache, `openfda:${publicUrl}`, 1800, async () => { const response = await this.fetcher(requestUrl); if (response.status === 404) return { results: [] }; if (!response.ok) throw new Error(`openFDA ${response.status}`); return response.json(); });
    return { data, cache, url: publicUrl.toString() };
  }
  async get(kind: OpenFdaKind, identifier: string) {
    if (kind === 'device_510k') { const result = await this.request('device/510k', `k_number:${identifier.toUpperCase()}`, 1); const rows = z.object({ results: z.array(DeviceSchema) }).parse(result.data).results; return { records: rows.map((row) => this.projectDevice(row)), ...result }; }
    if (kind === 'drug_label') { const result = await this.request('drug/label', `openfda.application_number:${identifier.toUpperCase()}`, 10); const rows = z.object({ results: z.array(LabelSchema) }).parse(result.data).results; return { records: rows.map((row) => this.projectLabel(row)), ...result }; }
    const result = await this.request('drug/drugsfda', `application_number:${identifier.toUpperCase()}`, 1); const rows = z.object({ results: z.array(DrugSchema) }).parse(result.data).results; return { records: rows.map((row) => this.projectDrug(row)), ...result };
  }
  async search(query: string, limit = 10) {
    const escaped = query.replace(/["\\]/g, ''); const result = await this.request('drug/drugsfda', `products.brand_name:"${escaped}"`, limit);
    return { records: z.object({ results: z.array(DrugSchema) }).parse(result.data).results.map((row) => this.projectDrug(row)), cache: result.cache, url: result.url };
  }
  async findLabelsMentioningNct(nctId: string, limit = 10) {
    const result = await this.request('drug/label', nctId.toUpperCase(), limit);
    const rows = z.object({ results: z.array(LabelSchema) }).parse(result.data).results.filter((row) => nctMentions(row).includes(nctId.toUpperCase()));
    return { records: rows.map((row) => this.projectLabel(row)), cache: result.cache, url: result.url };
  }
  private projectDrug(row: Drug): FDAProductRef { const latest = [...(row.submissions ?? [])].sort((a, b) => (b.submission_status_date ?? '').localeCompare(a.submission_status_date ?? ''))[0]; return FDAProductRefSchema.parse({ boundary_type: BoundaryNames.fda, record_kind: 'drug_application', record_id: row.application_number, application_number: row.application_number, sponsor_applicant: row.sponsor_name, brand_names: [...new Set((row.products ?? []).flatMap((p) => p.brand_name ? [p.brand_name] : []))], ingredients: [...new Set((row.products ?? []).flatMap((p) => p.active_ingredients?.map((i) => i.name) ?? []))], generic_names: [], status: latest?.submission_status, event_date: compactDate(latest?.submission_status_date), nct_mentions: nctMentions(row), source_url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${row.application_number.replace(/\D/g, '')}`, data_mode: 'live_api' }); }
  private projectDevice(row: Device): FDAProductRef { return FDAProductRefSchema.parse({ boundary_type: BoundaryNames.fda, record_kind: 'device_510k', record_id: row.k_number, k_number: row.k_number, sponsor_applicant: row.applicant, brand_names: row.device_name ? [row.device_name] : [], generic_names: [], ingredients: [], status: row.decision_code, event_date: compactDate(row.decision_date), nct_mentions: nctMentions(row), source_url: `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=${row.k_number}`, data_mode: 'live_api' }); }
  private projectLabel(row: Label): FDAProductRef { const application = row.openfda?.application_number?.[0]; const id = row.set_id ?? row.id ?? application ?? crypto.randomUUID(); return FDAProductRefSchema.parse({ boundary_type: BoundaryNames.fda, record_kind: 'drug_label', record_id: id, ...(application ? { application_number: application } : {}), sponsor_applicant: row.openfda?.manufacturer_name?.[0], brand_names: row.openfda?.brand_name ?? [], generic_names: row.openfda?.generic_name ?? [], ingredients: row.openfda?.substance_name ?? [], nct_mentions: nctMentions(row), source_url: `https://api.fda.gov/drug/label.json?search=set_id:${encodeURIComponent(id)}`, data_mode: 'live_api' }); }
}
