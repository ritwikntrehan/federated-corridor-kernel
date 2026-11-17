import { z } from 'zod';
import snapshot from '../../data/patents.snapshot.json';
import { BoundaryNames, PatentGrantRefSchema, type PatentGrantRef } from '../contracts';
import { normalizeProjectNumber } from './reporter';

const RowSchema = z.object({
  patent_number: z.string(), title: z.string(), grant_date: z.string(), assignees: z.array(z.string()), inventors: z.array(z.string()),
  cpc_categories: z.array(z.string()), government_interest: z.array(z.object({ text: z.string(), core_project_ids: z.array(z.string()) })),
  non_patent_literature: z.array(z.object({ doi: z.string().optional(), pmid: z.string().optional(), text: z.string() })), source_url: z.string().url()
});
const SnapshotSchema = z.object({ snapshot_date: z.string(), snapshot_source: z.string().url(), records: z.array(RowSchema) });
type Row = z.infer<typeof RowSchema>;

export function normalizePatentNumber(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function patentCore(value: string) { return normalizePatentNumber(value).replace(/^US/, '').replace(/[A-Z]\d$/, ''); }
export class UsptoAdapter {
  readonly country = 'uspto';
  private readonly data = SnapshotSchema.parse(snapshot);
  getByPatentNumber(value: string): PatentGrantRef | undefined {
    const key = patentCore(value); const row = this.data.records.find((record) => patentCore(record.patent_number) === key);
    return row ? this.project(row) : undefined;
  }
  findByGovernmentAward(value: string) {
    const normalized = normalizeProjectNumber(value); if (!normalized.core) return [] as PatentGrantRef[];
    return this.data.records.filter((row) => row.government_interest.some((interest) => interest.core_project_ids.some((id) => normalizeProjectNumber(id).core === normalized.core))).map((row) => this.project(row));
  }
  search(query: string, limit = 10) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean); return this.data.records.filter((row) => {
      const haystack = [row.title, ...row.assignees, ...row.inventors, ...row.cpc_categories].join(' ').toLowerCase(); return terms.every((term) => haystack.includes(term));
    }).slice(0, Math.min(limit, 25)).map((row) => this.project(row));
  }
  all() { return this.data.records.map((row) => this.project(row)); }
  private project(row: Row): PatentGrantRef { return PatentGrantRefSchema.parse({ boundary_type: BoundaryNames.patent, ...row, data_mode: 'verified_public_snapshot', snapshot_source: this.data.snapshot_source, snapshot_date: this.data.snapshot_date }); }
}
