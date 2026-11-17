import { OpenAlexAdapter, type OpenAlexWork } from './adapters/openalex';
import { ClinicalTrialsAdapter, references, type ClinicalStudy } from './adapters/clinicaltrials';
import { ReporterAdapter, type ReporterProject } from './adapters/reporter';
import { BoundaryNames, CohortQuerySchema, CohortResultSchema, type CohortQuery, type CohortResult, type DiplomaticEnvelope, type EvidenceGraph, type EvidenceNode, type ScholarlyWorkRef } from './contracts';
import { makeEnvelope, type CacheLike, type Fetcher } from './kernel';
import { createRegistry } from './registry';

type ErrorRow = CohortResult['errors'][number];
const REQUEST_BUDGET = 45;
const corridor = () => ({ attempts: 0, verified_edges: 0, hypothesis_edges: 0, no_matches: 0, errors: 0 });
function unique<T>(values: T[]) { return [...new Set(values)]; }
function mergeGraph(target: EvidenceGraph, source: EvidenceGraph) {
  const nodes = new Map(target.nodes.map((n) => [n.id, n])); source.nodes.forEach((n) => nodes.set(n.id, n)); target.nodes = [...nodes.values()];
  const edges = new Map(target.edges.map((e) => [e.id, e])); source.edges.forEach((e) => edges.set(e.id, e)); target.edges = [...edges.values()];
}

export async function traverseCohort(input: CohortQuery, options: { fetch: Fetcher; cache: CacheLike; now?: () => Date; openAlexApiKey?: string; requestBudget?: number }): Promise<CohortResult> {
  const query = CohortQuerySchema.parse(input); const now = options.now ?? (() => new Date()); const graph: EvidenceGraph = { nodes: [], edges: [] }; const envelopes: DiplomaticEnvelope[] = []; const errors: ErrorRow[] = [];
  const openalex = new OpenAlexAdapter(options.fetch, options.cache, options.openAlexApiKey); const trials = new ClinicalTrialsAdapter(options.fetch, options.cache); const reporter = new ReporterAdapter(options.fetch, options.cache); const registry = createRegistry();
  const telemetry: CohortResult['telemetry'] = { seeds_discovered: 0, seeds_selected: 0, seeds_attempted: 0, seeds_completed: 0, unique_boundary_keys_extracted: {}, corridors: {}, unique_source_nodes: 0, unique_verified_relationships: 0, unique_hypothesis_relationships: 0, provider_requests: 0, cache_hits: 0, deduplicated_requests: 0, timeouts: 0, retries: 0, partial_budget_stops: 0, drop_off_reasons: {} };
  const keys = new Map<string, Set<string>>(); const requested = new Set<string>(); let stopped = false;
  const inc = (name: string) => { telemetry.drop_off_reasons[name] = (telemetry.drop_off_reasons[name] ?? 0) + 1; };
  const key = (kind: string, value: string) => { const set = keys.get(kind) ?? new Set<string>(); set.add(value); keys.set(kind, set); };
  const countResult = (cache: 'hit' | 'miss' | 'bypass') => { if (cache === 'hit') telemetry.cache_hits++; else if (cache === 'miss') telemetry.provider_requests++; };
  const mayRequest = (requestKey: string) => {
    if (requested.has(requestKey)) { telemetry.deduplicated_requests++; return false; }
    if (telemetry.provider_requests >= (options.requestBudget ?? REQUEST_BUDGET)) { telemetry.partial_budget_stops++; inc('request_budget_exceeded'); stopped = true; return false; }
    requested.add(requestKey); return true;
  };
  const addNode = (node: EvidenceNode) => { if (!graph.nodes.some((n) => n.id === node.id)) graph.nodes.push(node); };
  const context = { fetch: options.fetch, cache: options.cache, now };
  const directEnvelope = (trial: ReturnType<ClinicalTrialsAdapter['project']>, work: ScholarlyWorkRef, method: 'exact_pmid' | 'exact_doi', url: string, cache: 'hit' | 'miss') => {
    const from = `ctg:${trial.nct_id}`, to = `openalex:${work.openalex_id.replace(/^.*\//, '')}`;
    return makeEnvelope({ payload: [work], passport: { origin_country: 'clinicaltrials.gov', source_identifier: trial.nct_id, source_url: trial.source_url, retrieved_at: now().toISOString(), hops: [{ from_country: 'clinicaltrials.gov', to_country: 'openalex', corridor_id: 'clinicaltrials-to-openalex', request: { method: 'GET', url, cache_status: cache }, duration_ms: 0, timestamp: now().toISOString() }] },
      customs: { boundary_schema: BoundaryNames.trial, status: 'pass', accepted_count: 1, rejected_count: 0, normalization_notes: ['Exact publication reference lookup; this is an association, not a causal claim.'], mismatch_reasons: [] },
      interpreter: [{ source_field_path: 'protocolSection.referencesModule.references[].pmid/citation', canonical_name: 'publication_identifier', semantics: 'Exact PMID or DOI copied from the registered study reference and used for OpenAlex lookup.', null_semantics: 'No reference means this path cannot run.', transformation_version: 'ctg-openalex@0.2' }],
      evidence: { nodes: [
        { id: from, country: 'clinicaltrials.gov', type: 'registered-study', label: `${trial.nct_id} · ${trial.status ?? 'status unavailable'}`, state: 'verified', source_uri: trial.source_url, record_id: trial.nct_id, boundary: trial },
        { id: to, country: 'openalex', type: 'scholarly-work', label: work.title ?? work.openalex_id, state: 'verified', source_uri: work.source_url, record_id: work.openalex_id, boundary: work }
      ], edges: [{ id: `edge:${from}:${to}:${method}`, from, to, corridor_id: 'clinicaltrials-to-openalex', state: 'verified', evidence_tier: 'verified', match_method: method, supporting_uris: [trial.source_url, work.source_url], supporting_record_ids: [trial.nct_id, method === 'exact_pmid' ? work.pmid! : work.doi!], explanation: `ClinicalTrials.gov listed the exact ${method === 'exact_pmid' ? 'PMID' : 'DOI'} resolved by OpenAlex; this verifies a publication-reference association only.` }] } });
  };

  const processWork = async (record: OpenAlexWork, sourceTrial?: { study: ClinicalStudy; method: 'exact_pmid' | 'exact_doi'; lookupUrl: string; cache: 'hit' | 'miss' }) => {
    const work = openalex.projectWork(record); key('PMID', work.pmid ?? ''); key('DOI', work.doi ?? '');
    addNode({ id: `openalex:${work.openalex_id.replace(/^.*\//, '')}`, country: 'openalex', type: 'scholarly-work', label: work.title ?? work.openalex_id, state: 'verified', source_uri: work.source_url, record_id: work.openalex_id, boundary: work, raw_record: record });
    if (sourceTrial) { const trial = trials.project(sourceTrial.study, { method: 'exact_nct' }, now()); const env = directEnvelope(trial, work, sourceTrial.method, sourceTrial.lookupUrl, sourceTrial.cache); envelopes.push(env); mergeGraph(graph, env.evidence); const m = telemetry.corridors['clinicaltrials-to-openalex'] ??= corridor(); m.attempts++; m.verified_edges++; }
    if (query.corridors.includes('openalex-to-nih-reporter')) {
      const awards = openalex.projectAwards(record); if (!awards.length) inc('non_nih_award');
      for (const award of awards) {
        if (stopped) break; const normalizedKey = award.original_funder_award_id.toUpperCase().replace(/\s+/g, ''); key(normalizedKey.startsWith('HHSN') || normalizedKey.startsWith('75N') ? 'unsupported_contract_or_foreign_award' : 'supported_NIH_core', normalizedKey);
        const metric = telemetry.corridors['openalex-to-nih-reporter'] ??= corridor(); metric.attempts++;
        if (!mayRequest(`reporter:project:${normalizedKey}`)) { if (!stopped) metric.no_matches++; continue; }
        const env = await registry.get('openalex-to-nih-reporter').traverse(award, context); envelopes.push(env); mergeGraph(graph, env.evidence); const hopCache = env.passport.hops[0]?.request.cache_status; if (hopCache) countResult(hopCache);
        const verified = env.evidence.edges.filter((e) => e.state === 'verified').length; metric.verified_edges += verified; if (!verified) metric.no_matches++;
        if (env.status === 'failed' && env.errors.some((e) => e.code === 'PROVIDER_FAILURE')) { metric.errors++; inc('provider_unavailable'); }
        if (env.errors.some((e) => e.code === 'UNSUPPORTED_AWARD')) inc('unsupported_nih_contract'); if (!env.payload || !(env.payload as unknown[]).length) inc('no_project_match');
      }
    }
    if (query.corridors.includes('openalex-to-clinical-trials') && !sourceTrial && (work.pmid || work.doi)) {
      const lookup = work.pmid ?? work.doi!; const metric = telemetry.corridors['openalex-to-clinical-trials'] ??= corridor(); metric.attempts++;
      if (mayRequest(`ctg:publication:${lookup}`)) { const env = await registry.get('openalex-to-clinical-trials').traverse(work, context); envelopes.push(env); mergeGraph(graph, env.evidence); const hopCache = env.passport.hops[0]?.request.cache_status; if (hopCache) countResult(hopCache); const verified = env.evidence.edges.filter((e) => e.state === 'verified').length; metric.verified_edges += verified; if (!verified) { metric.no_matches++; inc('no_exact_nct_reference'); } if (env.status === 'failed') metric.errors++; }
    }
  };

  const selectedIds: string[] = []; const offset = query.continuation?.seed_offset ?? 0;
  try {
    if (query.origin_country === 'clinicaltrials.gov') {
      if (!mayRequest(`ctg:cohort:${JSON.stringify(query.seed_filter)}:${offset}`)) throw new Error('request budget exhausted before discovery');
      const found = await trials.discoverCohort({ ...(query.seed_filter.domain ? { domain: query.seed_filter.domain } : {}), ...(query.seed_filter.status ? { status: query.seed_filter.status } : {}), ...(query.seed_filter.phase ? { phase: query.seed_filter.phase } : {}), ...(query.seed_filter.study_type ? { studyType: query.seed_filter.study_type } : {}) }, query.max_seeds); countResult(found.cache);
      telemetry.seeds_discovered = found.total; const uniqueStudies = [...new Map(found.records.map((s) => [s.protocolSection.identificationModule.nctId, s])).values()].slice(offset, offset + query.max_seeds); telemetry.seeds_selected = uniqueStudies.length;
      for (const study of uniqueStudies) { if (stopped) break; const trial = trials.project(study, { method: 'exact_nct' }, now()); selectedIds.push(trial.nct_id); telemetry.seeds_attempted++; key('NCT', trial.nct_id); addNode({ id: `ctg:${trial.nct_id}`, country: 'clinicaltrials.gov', type: 'registered-study', label: `${trial.nct_id} · ${trial.status ?? 'status unavailable'}`, state: 'verified', source_uri: trial.source_url, record_id: trial.nct_id, boundary: trial, raw_record: study });
        const refs = references(study); const pmids = unique(refs.flatMap((r) => r.pmid ? [r.pmid] : [])); const dois = unique(refs.flatMap((r) => r.citation?.match(/doi:\s*([^\s,;]+)/i)?.[1]?.replace(/[.)]$/, '') ? [r.citation.match(/doi:\s*([^\s,;]+)/i)![1]!.replace(/[.)]$/, '')] : [])); pmids.forEach((v) => key('PMID', v)); dois.forEach((v) => key('DOI', v));
        if (!pmids.length && !dois.length) { inc('no_publication_reference'); (telemetry.corridors['clinicaltrials-to-openalex'] ??= corridor()).no_matches++; telemetry.seeds_completed++; continue; }
        let linked = false; for (const [id, method] of [...pmids.map((id) => [id, 'exact_pmid'] as const), ...dois.map((id) => [id, 'exact_doi'] as const)].slice(0, 3)) { if (!mayRequest(`openalex:work:${id}`)) continue; try { const foundWork = await openalex.getWorkByIdOrPmid(id); countResult(foundWork.cache); await processWork(foundWork.record, { study, method, lookupUrl: foundWork.url, cache: foundWork.cache }); linked = true; } catch (error) { inc(method === 'exact_pmid' ? 'missing_pmid' : 'no_publication_reference'); errors.push({ code: 'OPENALEX_LOOKUP_FAILED', message: error instanceof Error ? error.message : String(error), provider: 'openalex', seed_id: trial.nct_id }); (telemetry.corridors['clinicaltrials-to-openalex'] ??= corridor()).errors++; } }
        if (!linked) (telemetry.corridors['clinicaltrials-to-openalex'] ??= corridor()).no_matches++; telemetry.seeds_completed++;
      }
    } else if (query.origin_country === 'openalex') {
      if (!mayRequest(`openalex:cohort:${JSON.stringify(query.seed_filter)}:${offset}`)) throw new Error('request budget exhausted before discovery'); const found = await openalex.discoverCohort({ ...(query.seed_filter.topic ? { topic: query.seed_filter.topic } : {}), ...(query.seed_filter.institution_ror ? { institutionRor: query.seed_filter.institution_ror } : {}) }, query.max_seeds, offset); countResult(found.cache); telemetry.seeds_discovered = found.total; telemetry.seeds_selected = found.records.length;
      for (const work of found.records) { if (stopped) break; selectedIds.push(work.id); telemetry.seeds_attempted++; await processWork(work); telemetry.seeds_completed++; }
    } else {
      const discoveryFilter = { domain: query.seed_filter.domain!, fiscalYearFrom: query.seed_filter.fiscal_year_from!, fiscalYearTo: query.seed_filter.fiscal_year_to!, ...(query.seed_filter.activity_codes ? { activityCodes: query.seed_filter.activity_codes } : {}) };
      if (!mayRequest(`reporter:cohort:${JSON.stringify(query.seed_filter)}:0`)) throw new Error('request budget exhausted before discovery'); const found = await reporter.discoverProjects(discoveryFilter, 50, 0); countResult(found.cache); const discoveryRows: ReporterProject[] = [...found.records];
      let discoveryOffset = 50; let discoveryPages = 1;
      while (new Set(discoveryRows.map((p) => p.core_project_num)).size < query.max_seeds && discoveryOffset < found.total && discoveryPages < 4 && mayRequest(`reporter:cohort:${JSON.stringify(query.seed_filter)}:${discoveryOffset}`)) { const next = await reporter.discoverProjects(discoveryFilter, 50, discoveryOffset); countResult(next.cache); discoveryRows.push(...next.records); discoveryOffset += 50; discoveryPages++; }
      const discoveredCores = unique(discoveryRows.map((p) => p.core_project_num)); telemetry.seeds_discovered = discoveredCores.length; const selectedCores = discoveredCores.slice(offset, offset + query.max_seeds); telemetry.seeds_selected = selectedCores.length;
      for (const core of selectedCores) { if (stopped) break; const rows = discoveryRows.filter((p) => p.core_project_num === core); const project = rows[0]!; selectedIds.push(core); telemetry.seeds_attempted++; key('supported_NIH_core', core);
        for (const row of rows) { const projectedRow = reporter.project(row); addNode({ id: `reporter:${row.appl_id}`, country: 'nih-reporter', type: 'project-year', label: `${row.core_project_num} · FY${row.fiscal_year}`, state: 'verified', source_uri: projectedRow.source_url, record_id: String(row.appl_id), boundary: projectedRow, raw_record: row }); }
        const projected = reporter.project(project);
        if (!mayRequest(`reporter:publications:${project.core_project_num}`)) continue; const pubs = await reporter.findPublications({ coreProjectNums: [project.core_project_num] }, 25); countResult(pubs.cache); const pmids = unique(pubs.records.map((p) => String(p.pmid))); if (!pmids.length) inc('no_publication_reference');
        for (const pmid of pmids.slice(0, 3)) { key('PMID', pmid); if (!mayRequest(`openalex:work:${pmid}`)) continue; try { const work = await openalex.getWorkByIdOrPmid(pmid); countResult(work.cache); await processWork(work.record); const target = `openalex:${work.record.id.replace(/^.*\//, '')}`; graph.edges.push({ id: `edge:reporter:${project.appl_id}:${target}:pmid:${pmid}`, from: `reporter:${project.appl_id}`, to: target, corridor_id: 'nih-reporter-to-openalex-publication', state: 'verified', evidence_tier: 'verified', match_method: 'exact_pmid', supporting_uris: [projected.source_url, work.record.id], supporting_record_ids: [project.core_project_num, pmid], explanation: 'RePORTER linked this exact PMID to the project and OpenAlex resolved the same PMID; this is an association, not a causal production claim.' }); } catch (error) { errors.push({ code: 'OPENALEX_LOOKUP_FAILED', message: error instanceof Error ? error.message : String(error), provider: 'openalex', seed_id: project.core_project_num }); inc('provider_unavailable'); } } telemetry.seeds_completed++;
      }
    }
  } catch (error) { errors.push({ code: 'COHORT_DISCOVERY_FAILED', message: error instanceof Error ? error.message : String(error), provider: query.origin_country }); inc('provider_unavailable'); }

  if (query.include_hypothesis_edges) inc('missing_candidate_attributes');
  for (const [kind, values] of keys) telemetry.unique_boundary_keys_extracted[kind] = [...values].filter(Boolean).length;
  telemetry.unique_source_nodes = new Set(graph.nodes.map((n) => n.id)).size; telemetry.unique_verified_relationships = new Set(graph.edges.filter((e) => e.state === 'verified').map((e) => e.id)).size; telemetry.unique_hypothesis_relationships = new Set(graph.edges.filter((e) => e.state === 'candidate').map((e) => e.id)).size;
  const continuation = stopped ? { seed_offset: offset + telemetry.seeds_completed } : null; const status = errors.length || stopped ? graph.nodes.length ? 'partial' : 'failed' : 'complete';
  return CohortResultSchema.parse({ schema_version: '0.2', status, query, selected_seed_ids: selectedIds, graph, envelopes, telemetry, errors, continuation, generated_at: now().toISOString() });
}
