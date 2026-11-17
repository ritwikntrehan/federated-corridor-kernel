import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { OpenAlexAdapter } from './adapters/openalex';
import { bounded, MemoryCache, type CacheLike } from './kernel';
import { createRegistry } from './registry';
import { investigate } from './investigate';
import { openapi } from './openapi';
import { handleMcp } from './mcp';

export interface Env { CORRIDOR_CACHE?: KVNamespace; ASSETS?: Fetcher; OPENALEX_API_KEY?: string; }
const fallback = new MemoryCache(200);
const workerFetch: typeof fetch = (input, init) => fetch(input, init);
function cache(env: Env): CacheLike { return env.CORRIDOR_CACHE ?? fallback; }
function options(env: Env) { return { fetch: workerFetch, cache: cache(env), now: () => new Date(), ...(env.OPENALEX_API_KEY ? { openAlexApiKey: env.OPENALEX_API_KEY } : {}) }; }

export const app = new Hono<{ Bindings: Env }>();
app.use('/api/*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], maxAge: 86400 }));
app.onError((error, c) => c.json({ status: 'failed', error: { code: error instanceof z.ZodError ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR', message: error.message, ...(error instanceof z.ZodError ? { issues: error.issues } : {}) } }, error instanceof z.ZodError ? 400 : 500));
app.get('/api/v1/health', (c) => c.json({ status: 'ok', service: 'federated-corridor-kernel', version: '0.1.0', time: new Date().toISOString(), cache: c.env.CORRIDOR_CACHE ? 'kv' : 'bounded-memory-fallback' }));
app.get('/api/v1/capabilities', (c) => c.json(createRegistry().capabilities()));
app.get('/api/v1/openapi.json', (c) => c.json(openapi));
app.get('/api/v1/examples', (c) => c.json({ verified_at: '2026-11-16', examples: [{ id: 'sprint-three-source', label: 'SPRINT publication → NIH project years + registered study', seeds: { work_id: 'W4304757292', pmid: '36223105', nct_id: 'NCT01206062', project_id: 'R01HL136679' },
  verified_paths: [{ match_method: 'exact_pmid', path: ['OpenAlex W4304757292', 'PMID 36223105', 'ClinicalTrials.gov NCT01206062'] }, { match_method: 'verified_award + exact_pmid corroboration', path: ['OpenAlex W4304757292 awards[0].funder_award_id R01HL136679', 'RePORTER core project R01HL136679', 'RePORTER publication PMID 36223105'] }], caveat: 'RePORTER award amounts are project-record fiscal-year amounts, not amounts paid to author the paper.' }] }));
app.get('/api/v1/works', async (c) => { const query = z.string().trim().min(2).max(200).parse(c.req.query('q')); const limit = z.coerce.number().int().min(1).max(25).default(10).parse(c.req.query('limit') ?? 10); const adapter = new OpenAlexAdapter(workerFetch, cache(c.env), c.env.OPENALEX_API_KEY); const found = await adapter.discoverWorks(query, limit); return c.json({ results: found.records.map((record) => ({ work: adapter.projectWork(record), awards: adapter.projectAwards(record) })), request: { url: found.url, cache: found.cache } }); });
app.post('/api/v1/traverse/:corridorId', async (c) => { const corridor = createRegistry().get(c.req.param('corridorId')); const body = await c.req.json(); const input = typeof body === 'object' && body && 'payload' in body ? (body as { payload: unknown }).payload : body; const value = await bounded(corridor.traverse(input, { fetch: workerFetch, cache: cache(c.env), now: () => new Date() }), corridor.limits.timeoutMs); return c.json(value); });
app.get('/api/v1/investigate', async (c) => { const query = c.req.query(); const supplied = ['work_id', 'pmid', 'nct_id', 'project_id'].filter((k) => query[k]); if (supplied.length !== 1) return c.json({ status: 'failed', error: { code: 'INVALID_SEED', message: 'Provide exactly one of work_id, pmid, nct_id, or project_id.' } }, 400); return c.json(await investigate({ [supplied[0]!]: query[supplied[0]!] }, options(c.env))); });
app.all('/mcp', (c) => handleMcp(c.req.raw, options(c.env)));
app.all('/mcp/*', (c) => handleMcp(c.req.raw, options(c.env)));
app.get('*', async (c) => c.env.ASSETS ? c.env.ASSETS.fetch(c.req.raw) : c.text('Federated Corridor Kernel. See /api/v1/capabilities.', 200));
