import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createMcpServer } from '../src/mcp';
import { MemoryCache } from '../src/kernel';
import { fixtureFetch } from './helpers';

describe('official MCP client transport', () => {
  it('discovers and invokes the five bounded tools', async () => { const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair(); const server = createMcpServer({ fetch: fixtureFetch().fn, cache: new MemoryCache() }); const client = new Client({ name: 'test-client', version: '1.0.0' }); await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]); const tools = await client.listTools(); expect(tools.tools.map((t) => t.name).sort()).toEqual(['investigate_research_chain', 'list_corridors', 'list_countries', 'resolve_boundary', 'traverse_corridor']); const called = await client.callTool({ name: 'list_countries', arguments: {} }); expect(called.content).toBeTruthy(); await client.close(); await server.close(); });
});
