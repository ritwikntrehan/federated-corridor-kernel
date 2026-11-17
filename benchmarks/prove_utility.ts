import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { traverseCohort } from '../src/cohort';
import { investigate } from '../src/investigate';
import { MemoryCache } from '../src/kernel';
import type { CohortQuery, CohortResult } from '../src/contracts';

const started = Date.now(); const runAt = new Date().toISOString(); const output = resolve('benchmarks/results/utility-proof.json'); const report = resolve('UTILITY_PROOF.md');
const commit = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'unavailable'; } })();
const benchmark1Query: CohortQuery = { origin_country: 'clinicaltrials.gov', seed_filter: { domain: 'oncology', status: 'TERMINATED', phase: 'PHASE2', study_type: 'INTERVENTIONAL' }, max_seeds: 15, corridors: ['clinicaltrials-to-openalex', 'openalex-to-nih-reporter'], include_hypothesis_edges: false };
const benchmark2Query: CohortQuery = { origin_country: 'nih-reporter', seed_filter: { domain: 'cardiovascular', fiscal_year_from: 2016, fiscal_year_to: 2022, activity_codes: ['R01', 'U01'] }, max_seeds: 15, corridors: ['openalex-to-clinical-trials'], include_hypothesis_edges: false };
const benchmark3Query: CohortQuery = { ...benchmark1Query, include_hypothesis_edges: true };

function esc(value: unknown) { return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' '); }
function trialRows(result: CohortResult) {
  return result.selected_seed_ids.map((id) => { const trial = result.graph.nodes.find((n) => n.record_id === id)?.boundary as { status?: string; why_stopped?: string; study_dates?: { completion?: string; primary_completion?: string }; matching_publication_ids?: { pmids: string[]; dois: string[] } } | undefined;
    const linked = result.graph.edges.filter((e) => e.from === `ctg:${id}` && e.state === 'verified'); const works = linked.map((e) => result.graph.nodes.find((n) => n.id === e.to)?.boundary as { pmid?: string; doi?: string; counts_by_year?: unknown[] } | undefined).filter(Boolean);
    const workUris = new Set(linked.map((e) => result.graph.nodes.find((n) => n.id === e.to)?.source_uri).filter(Boolean)); const awardNodeIds = new Set(result.graph.nodes.filter((n) => n.type === 'grant-award' && workUris.has((n.boundary as { source_work_id?: string } | undefined)?.source_work_id)).map((n) => n.id));
    const projectNodeIds = new Set(result.graph.edges.filter((e) => awardNodeIds.has(e.from) && e.state === 'verified').map((e) => e.to)); const cores = [...new Set(result.graph.nodes.filter((n) => projectNodeIds.has(n.id)).map((n) => (n.boundary as { core_project_id?: string } | undefined)?.core_project_id).filter(Boolean))]; const missing = !linked.length ? 'no exact publication reference or OpenAlex resolution' : !cores.length ? 'no supported NIH project match' : '—';
    return `| ${esc(id)} | ${esc(trial?.status)} | ${esc(trial?.why_stopped ?? 'not supplied')} | ${esc(trial?.study_dates?.completion ?? trial?.study_dates?.primary_completion ?? 'unknown')} | ${esc(works.flatMap((w) => [w?.pmid, w?.doi]).filter(Boolean).join(', ') || 'none')} | ${esc(works.some((w) => w?.counts_by_year?.length) ? 'available in raw artifact' : 'unknown')} | ${esc(cores.join(', ') || 'none')} | ${missing} |`; });
}
function projectRows(result: CohortResult) { return result.selected_seed_ids.map((id) => { const nodes = result.graph.nodes.filter((n) => (n.boundary as { core_project_id?: string } | undefined)?.core_project_id === id); const projects = nodes.map((n) => n.boundary as { fiscal_year?: number; amount?: number | null; direct_cost_amount?: number | null; indirect_cost_amount?: number | null; study_section?: { code?: string } }); const projectNodeIds = new Set(nodes.map((n) => n.id)); const workNodeIds = new Set(result.graph.edges.filter((e) => projectNodeIds.has(e.from) && e.state === 'verified').map((e) => e.to)); const trialNodeIds = new Set(result.graph.edges.filter((e) => workNodeIds.has(e.from) && e.state === 'verified').map((e) => e.to)); return `| ${esc(id)} | ${esc(projects[0]?.study_section?.code ?? 'not supplied')} | ${esc([...new Set(projects.map((p) => p.fiscal_year))].join(', '))} | ${esc(projects.map((p) => p.amount ?? 'missing').join(', '))} | ${esc(projects.map((p) => `${p.direct_cost_amount ?? 'missing'}/${p.indirect_cost_amount ?? 'missing'}`).join(', '))} | ${workNodeIds.size} | ${trialNodeIds.size} |`; }); }
function funnel(result: CohortResult) { return Object.entries(result.telemetry.corridors).map(([id, m]) => `| ${id} | ${m.attempts} | ${m.verified_edges} | ${m.hypothesis_edges} | ${m.no_matches} | ${m.errors} |`).join('\n') || '| none | 0 | 0 | 0 | 0 | 0 |'; }
function providerUrls(results: CohortResult[]) { return [...new Set(results.flatMap((r) => r.envelopes.flatMap((e) => e.passport.hops.map((h) => h.request.url))))].map((url) => url.replace(/([?&])api_key=[^&]+/g, '$1api_key=REDACTED')); }
function providerQueries() { const ctg = new URL('https://clinicaltrials.gov/api/v2/studies'); ctg.searchParams.set('query.cond', 'oncology'); ctg.searchParams.set('filter.overallStatus', 'TERMINATED'); ctg.searchParams.set('filter.advanced', 'AREA[Phase]PHASE2 AND AREA[StudyType]INTERVENTIONAL'); ctg.searchParams.set('pageSize', '15'); ctg.searchParams.set('format', 'json'); return { clinicaltrials_seed_url: ctg.toString(), reporter_seed_body: { criteria: { advanced_text_search: { operator: 'and', search_field: 'projecttitle', search_text: 'cardiovascular' }, fiscal_years: [2016, 2017, 2018, 2019, 2020, 2021, 2022], activity_codes: ['R01', 'U01'] }, offset: 0, limit: 50, sort_field: 'core_project_num', sort_order: 'asc' }, openalex_lookup_template: 'https://api.openalex.org/works/{pmid:PMID|doi:DOI}' }; }

async function main() {
  mkdirSync(resolve('benchmarks/results'), { recursive: true }); const cache = new MemoryCache(2000); const options = { fetch, cache, now: () => new Date() };
  try {
    const golden = await investigate({ pmid: '36223105' }, options); const benchmark1 = await traverseCohort(benchmark1Query, { ...options, requestBudget: 200 }); const benchmark2 = await traverseCohort(benchmark2Query, { ...options, requestBudget: 200 }); const benchmark3 = await traverseCohort(benchmark3Query, { ...options, requestBudget: 200 });
    const verifiedStable = benchmark1.telemetry.unique_verified_relationships === benchmark3.telemetry.unique_verified_relationships;
    const degraded = golden.status === 'failed' || [benchmark1, benchmark2, benchmark3].some((r) => r.status === 'failed') || benchmark1.selected_seed_ids.length < 15 || benchmark2.selected_seed_ids.length < 15 || !verifiedStable;
    const artifact = { artifact_version: '0.2', run_kind: 'live', status: degraded ? 'degraded' : 'complete', run_utc: runAt, git_commit: commit, runtime_ms: Date.now() - started, worker_request_budget: 45, cli_request_budget: 200, methodology: { sampling: 'Stable provider ordering, first 15 returned records after source-side constraints and client-side phase/status validation; no preselection for publication identifiers.', caveat: 'Bounded exploratory samples are not population estimates.' }, queries: { benchmark1: benchmark1Query, benchmark2: benchmark2Query, benchmark3: benchmark3Query }, provider_queries: providerQueries(), selected_ids: { benchmark1: benchmark1.selected_seed_ids, benchmark2: benchmark2.selected_seed_ids, benchmark3: benchmark3.selected_seed_ids }, provider_request_urls: providerUrls([benchmark1, benchmark2, benchmark3]), golden_control: golden, benchmarks: { terminated_trials: benchmark1, nih_projects: benchmark2, candidate_audit: benchmark3 } };
    writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`);
    const markdown = `# Utility proof — live bounded cohort run

**Run status:** ${artifact.status}  
**Run UTC:** ${runAt}  
**Git commit:** \`${commit}\`  
**Runtime:** ${artifact.runtime_ms} ms  
**Mode:** live upstream requests (not fixtures)

## Executive answer

The kernel can combine registered-study status, stop reasons, enrollment semantics and exact publication references with OpenAlex work/citation metadata and exact NIH project-year award records. No one provider supplies that combined view. Every link below is an identifier-backed association; it does not establish that a grant funded a trial, that a project produced a paper, or that a registered outcome succeeded or failed.

The independent SPRINT control resolved with status **${golden.status}** across ${new Set(golden.graph.nodes.map((n) => n.country)).size} provider countries. The terminated-trial sample produced **${benchmark1.telemetry.unique_verified_relationships} unique verified relationships**. A zero is a valid observed yield, not replaced with fixture data.

## Method and limits

The cohort is a bounded sample of the first 15 records from stable, documented filters. It is not representative of all trials or projects. ClinicalTrials.gov status and phase are validated again after retrieval. OpenAlex annual citation counts are reported only for returned years; unavailable years remain unknown. NIH amounts are project-record fiscal-year values, not payments for a paper or trial. Direct and indirect amounts are not assumed to sum to award amount.

Provider request URLs are preserved in [the machine-readable artifact](benchmarks/results/utility-proof.json), with API keys removed. The production Worker reserves five of Cloudflare's 50 subrequests and stops at 45 with a continuation. This Node-side live runner uses a separate 200-request ceiling while retaining the shared RePORTER rate limiter.

## Benchmark 1 — terminated Phase II interventional oncology trials

| NCT ID | status | reason stopped | relevant date | exact PMID/DOI | supported citation years | verified NIH cores | missing-link reason |
|---|---|---|---|---|---|---|---|
${trialRows(benchmark1).join('\n') || '| no selected rows | — | — | — | — | — | — | provider returned no validated seeds |'}

This table describes exact publication-reference associations and associated NIH project records. It does not describe sunk capital or causal funding.

## Benchmark 2 — NIH R01/U01 project cohort

| NIH core | study section | fiscal years | project-year award USD | direct/indirect USD | OpenAlex works | exact NCT links |
|---|---|---|---|---|---|---|
${projectRows(benchmark2).join('\n') || '| no selected rows | — | — | — | — | — | — |'}

This is a funded-project/publication/trial-reference network. It does not establish that an award financed a trial or produced a clinical outcome.

## Benchmark 3 — exact-only versus candidate-augmented

| measure | exact only | candidate enabled |
|---|---:|---:|
| verified relationships | ${benchmark1.telemetry.unique_verified_relationships} | ${benchmark3.telemetry.unique_verified_relationships} |
| hypothesis relationships | ${benchmark1.telemetry.unique_hypothesis_relationships} | ${benchmark3.telemetry.unique_hypothesis_relationships} |
| missing candidate attributes | ${benchmark1.telemetry.drop_off_reasons.missing_candidate_attributes ?? 0} | ${benchmark3.telemetry.drop_off_reasons.missing_candidate_attributes ?? 0} |

Verified counts ${verifiedStable ? 'remained identical' : 'did not remain identical (degraded invariant)'}. Candidate coverage lift is ${benchmark3.telemetry.unique_hypothesis_relationships - benchmark1.telemetry.unique_hypothesis_relationships}; this is not recall or precision. Zero candidates means the existing APIs did not expose a defensible shared attribute bridge for this sample.

## Per-corridor funnels

### Benchmark 1

| corridor | attempts | verified edges | hypothesis edges | no matches | errors |
|---|---:|---:|---:|---:|---:|
${funnel(benchmark1)}

### Benchmark 2

| corridor | attempts | verified edges | hypothesis edges | no matches | errors |
|---|---:|---:|---:|---:|---:|
${funnel(benchmark2)}

## Independent API value versus federated value

- ClinicalTrials.gov supplied study status, reason stopped, dates, enrollment count/type, sponsor, outcomes, phases, and publication references where present.
- OpenAlex supplied work identity, publication dates, citation totals/available annual counts, institution RORs, and preserved funder-award identifiers where present.
- NIH RePORTER supplied project/application identity, fiscal-year awards, optional direct/indirect components, organization/PI/study-section fields, and project-publication PMID associations where present.
- The trial → publication and publication → project-year chains, cross-provider drop-offs, and per-corridor yield require joining at least two systems.

## Observed bottlenecks

${Object.entries(benchmark1.telemetry.drop_off_reasons).sort((a, b) => b[1] - a[1]).map(([reason, count], i) => `${i + 1}. \`${reason}\`: ${count}`).join('\n') || '1. No drop-off reason was counted in this bounded run.'}

Upstream failures remain errors and make this report degraded; the runner exits non-zero rather than presenting fixture output as live proof.
`;
    writeFileSync(report, markdown); if (degraded) process.exitCode = 2;
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error); const degraded = { artifact_version: '0.2', run_kind: 'live', status: 'degraded', run_utc: runAt, git_commit: commit, runtime_ms: Date.now() - started, error: message, queries: { benchmark1: benchmark1Query, benchmark2: benchmark2Query, benchmark3: benchmark3Query } }; writeFileSync(output, `${JSON.stringify(degraded, null, 2)}\n`); writeFileSync(report, `# Utility proof — degraded live run\n\n**Run UTC:** ${runAt}  \n**Git commit:** \`${commit}\`\n\nThe required live providers did not complete. No fixture-backed observations are presented as live proof.\n\nError: \`${message}\`\n`); process.exitCode = 2;
  }
}
await main();
if (process.exitCode) process.exit(process.exitCode);
