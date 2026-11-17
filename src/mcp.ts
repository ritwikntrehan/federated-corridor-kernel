import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { BoundarySchemas, CohortQuerySchema, type BoundaryName } from './contracts';
import { bounded, type CacheLike } from './kernel';
import { createRegistry } from './registry';
import { investigate } from './investigate';
import { traverseCohort } from './cohort';

function result(value: unknown) { return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }], structuredContent: { result: value } }; }
export function createMcpServer(options: { fetch: typeof fetch; cache: CacheLike; now?: () => Date; openAlexApiKey?: string }) {
  const server = new McpServer({ name: 'federated-corridor-kernel', version: '0.2.0' }); const registry = createRegistry(); const now = options.now ?? (() => new Date());
  server.registerTool('list_countries', { description: 'List source countries in the semantic mesh.', inputSchema: {} }, async () => result(registry.capabilities().countries));
  server.registerTool('list_corridors', { description: 'List bounded registered corridors and their typed inputs/outputs.', inputSchema: {} }, async () => result(registry.capabilities().corridors));
  server.registerTool('resolve_boundary', { description: 'Validate a value against a named boundary contract without making an upstream request.', inputSchema: { boundary_type: z.string(), value: z.unknown() } }, async ({ boundary_type, value }) => {
    const schema = BoundarySchemas[boundary_type as BoundaryName]; if (!schema) return result({ valid: false, issues: [`Unknown boundary ${boundary_type}`] }); const parsed = schema.safeParse(value); return result(parsed.success ? { valid: true, value: parsed.data } : { valid: false, issues: parsed.error.issues });
  });
  server.registerTool('traverse_corridor', { description: 'Execute exactly one registered, typed crossing.', inputSchema: { corridor_id: z.string(), input: z.unknown() } }, async ({ corridor_id, input }) => {
    try { const c = registry.get(corridor_id); return result(await bounded(c.traverse(input, { fetch: options.fetch, cache: options.cache, now }), c.limits.timeoutMs)); } catch (error) { return result({ status: 'failed', error: error instanceof Error ? error.message : String(error) }); }
  });
  server.registerTool('investigate_research_chain', { description: 'Run a bounded evidence investigation from exactly one work, PMID, NCT, or NIH project identifier.', inputSchema: { work_id: z.string().optional(), pmid: z.string().optional(), nct_id: z.string().optional(), project_id: z.string().optional() } }, async (seed) => {
    const clean = Object.fromEntries(Object.entries(seed).filter(([, value]) => value !== undefined)) as { work_id?: string; pmid?: string; nct_id?: string; project_id?: string };
    return result(await investigate(clean, options));
  });
  server.registerTool('traverse_cohort', { description: 'Traverse a bounded, auditable cohort with exact links by default and per-corridor yield telemetry.', inputSchema: CohortQuerySchema.shape }, async (query) => result(await traverseCohort(CohortQuerySchema.parse(query), options)));
  return server;
}

export async function handleMcp(request: Request, options: { fetch: typeof fetch; cache: CacheLike; now?: () => Date; openAlexApiKey?: string }) {
  const server = createMcpServer(options); const transport = new WebStandardStreamableHTTPServerTransport({}); await server.connect(transport); return transport.handleRequest(request);
}
