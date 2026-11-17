import { describe, expect, it, vi } from 'vitest';
import { BoundaryNames } from '../src/contracts';
import { checkIdentityAgreement, identity, makeEnvelope, Registry, type Corridor } from '../src/kernel';

const base = (id: string, input: keyof typeof BoundaryNames, output: keyof typeof BoundaryNames): Corridor => ({ id, title: id, inputBoundary: BoundaryNames[input], outputBoundary: BoundaryNames[output], matchMethods: [], sideEffects: 'none', limits: { maxInput: 1, maxOutput: 1, timeoutMs: 10 }, traverse: vi.fn() });
describe('operational composition', () => {
  it('identity preserves payload and evidence', () => { const e = makeEnvelope({ payload: { x: 1 }, passport: { origin_country: 'x', source_identifier: '1', source_url: 'https://example.test/1', retrieved_at: new Date(0).toISOString(), hops: [] }, customs: { boundary_schema: 'X@0.1', status: 'pass', accepted_count: 1, rejected_count: 0, normalization_notes: [], mismatch_reasons: [] } }); expect(identity(e)).toEqual(e); expect(identity(e)).not.toBe(e); });
  it('accepts compatible two-hop and rejects mismatch before traversal', () => { const a = base('a', 'work', 'grant'), b = base('b', 'grant', 'funding'), bad = base('bad', 'trial', 'work'); const r = new Registry().register(a).register(b).register(bad); expect(r.compose(['a', 'b'])).toHaveLength(2); expect(() => r.compose(['a', 'bad'])).toThrow(/incompatible/); expect(a.traverse).not.toHaveBeenCalled(); });
  it('adds a mock fourth country without kernel changes', () => { const r = new Registry().register(base('mock-to-openalex', 'trial', 'work')); expect(r.capabilities().corridors[0]?.id).toBe('mock-to-openalex'); });
  it('shows commuting conflicts instead of merging', () => { expect(checkIdentityAgreement({ id: 'PMID:1' }, { id: 'PMID:1' }).state).toBe('agreement'); expect(checkIdentityAgreement({ id: 'PMID:1' }, { id: 'PMID:2' })).toEqual({ state: 'conflict', claims: ['PMID:1', 'PMID:2'] }); });
});
