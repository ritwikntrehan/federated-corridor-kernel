import { describe, expect, it } from 'vitest';
import { investigate } from '../src/investigate';
import { MemoryCache } from '../src/kernel';
import { fixtureFetch } from './helpers';

describe('bounded multi-hop investigation', () => {
  it('preserves a source-backed three-system graph and all envelopes', async () => { const mock = fixtureFetch(); const result = await investigate({ pmid: '36223105' }, { fetch: mock.fn, cache: new MemoryCache(), now: () => new Date('2026-11-16T12:00:00Z') }); expect(new Set(result.graph.nodes.map((n) => n.country))).toEqual(new Set(['openalex', 'nih-reporter', 'clinicaltrials.gov'])); const ids = new Set(result.graph.nodes.map((n) => n.id)); expect(result.graph.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true); expect(result.envelopes.length).toBeGreaterThan(1); });
  it('keeps successful providers when another provider is missing', async () => { const mock = fixtureFetch({ fail: 'clinicaltrials' }); const result = await investigate({ pmid: '36223105' }, { fetch: mock.fn, cache: new MemoryCache() }); expect(result.status).toBe('partial'); expect(result.graph.nodes.some((n) => n.country === 'nih-reporter')).toBe(true); expect(result.errors.some((e) => e.provider === 'clinicaltrials.gov')).toBe(true); });
});
