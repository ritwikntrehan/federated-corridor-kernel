import { OpenAlexAdapter } from './adapters/openalex';
import { ClinicalTrialsAdapter, references } from './adapters/clinicaltrials';
import { ReporterAdapter, normalizeProjectNumber } from './adapters/reporter';
import type { DiplomaticEnvelope, EvidenceGraph } from './contracts';
import type { CacheLike, Fetcher } from './kernel';
import { createRegistry } from './registry';

export interface Investigation { schema_version: '0.1'; status: 'complete' | 'partial' | 'failed'; seed: Record<string, string>; graph: EvidenceGraph; envelopes: DiplomaticEnvelope[]; errors: { code: string; message: string; provider?: string }[]; generated_at: string; }
function mergeGraph(target: EvidenceGraph, source: EvidenceGraph) {
  const nodes = new Map(target.nodes.map((n) => [n.id, n])); source.nodes.forEach((n) => nodes.set(n.id, n));
  const edges = new Map(target.edges.map((e) => [e.id, e])); source.edges.forEach((e) => edges.set(e.id, e));
  target.nodes = [...nodes.values()]; target.edges = [...edges.values()];
}

export async function investigate(seed: { work_id?: string; pmid?: string; nct_id?: string; project_id?: string }, options: { fetch: Fetcher; cache: CacheLike; now?: () => Date; openAlexApiKey?: string }): Promise<Investigation> {
  const now = options.now ?? (() => new Date()); const graph: EvidenceGraph = { nodes: [], edges: [] }; const envelopes: DiplomaticEnvelope[] = []; const errors: Investigation['errors'] = [];
  const openalex = new OpenAlexAdapter(options.fetch, options.cache, options.openAlexApiKey); const ctg = new ClinicalTrialsAdapter(options.fetch, options.cache); const reporter = new ReporterAdapter(options.fetch, options.cache); const registry = createRegistry();
  const context = { fetch: options.fetch, cache: options.cache, now };
  const processWork = async (identifier: string) => {
    const { record } = await openalex.getWorkByIdOrPmid(identifier); const work = openalex.projectWork(record); const awards = openalex.projectAwards(record);
    graph.nodes.push({ id: `openalex:${work.openalex_id.replace(/^.*\//, '')}`, country: 'openalex', type: 'scholarly-work', label: work.title ?? work.openalex_id, state: 'verified', source_uri: work.source_url, record_id: work.openalex_id, boundary: work, raw_record: record });
    const trialEnvelope = await registry.get('openalex-to-clinical-trials').traverse(work, context); envelopes.push(trialEnvelope); mergeGraph(graph, trialEnvelope.evidence); errors.push(...trialEnvelope.errors.map(({ code, message, provider }) => ({ code, message, ...(provider ? { provider } : {}) })));
    for (const award of awards.slice(0, 5)) { const e = await registry.get('openalex-to-nih-reporter').traverse(award, context); envelopes.push(e); mergeGraph(graph, e.evidence); errors.push(...e.errors.map(({ code, message, provider }) => ({ code, message, ...(provider ? { provider } : {}) }))); }
  };
  try {
    if (seed.work_id || seed.pmid) await processWork(seed.work_id ?? seed.pmid!);
    else if (seed.nct_id) {
      const { record } = await ctg.getStudy(seed.nct_id); const trial = ctg.project(record, { method: 'exact_nct' }, now()); graph.nodes.push({ id: `ctg:${trial.nct_id}`, country: 'clinicaltrials.gov', type: 'registered-study', label: `${trial.nct_id} · ${trial.status ?? 'status unavailable'}`, state: 'verified', source_uri: trial.source_url, record_id: trial.nct_id, boundary: trial, raw_record: record });
      const pmids = [...new Set(references(record).flatMap((r) => r.pmid ? [r.pmid] : []))].slice(0, 3); for (const pmid of pmids) { try { await processWork(pmid); } catch (e) { errors.push({ code: 'OPENALEX_LOOKUP_FAILED', message: e instanceof Error ? e.message : String(e), provider: 'openalex' }); } }
    } else if (seed.project_id) {
      const norm = normalizeProjectNumber(seed.project_id); if (!norm.core) throw new Error('Unsupported project identifier');
      const pubs = await reporter.findPublications({ coreProjectNums: [norm.core] }, 5); const pmids = [...new Set(pubs.records.map((p) => String(p.pmid)))].slice(0, 3); if (!pmids.length) errors.push({ code: 'NO_PUBLICATIONS', message: 'RePORTER returned no publications for this exact core project.', provider: 'nih-reporter' });
      for (const pmid of pmids) { try { await processWork(pmid); } catch (e) { errors.push({ code: 'OPENALEX_LOOKUP_FAILED', message: e instanceof Error ? e.message : String(e), provider: 'openalex' }); } }
    } else throw new Error('Provide one seed: work_id, pmid, nct_id, or project_id');
  } catch (error) { errors.push({ code: 'INVESTIGATION_FAILED', message: error instanceof Error ? error.message : String(error) }); }
  const success = graph.nodes.some((n) => n.state === 'verified'); const failed = errors.some((e) => e.code === 'INVESTIGATION_FAILED');
  return { schema_version: '0.1', status: failed && !success ? 'failed' : errors.length ? 'partial' : 'complete', seed: Object.fromEntries(Object.entries(seed).filter(([, v]) => v !== undefined)) as Record<string, string>, graph, envelopes, errors, generated_at: now().toISOString() };
}
