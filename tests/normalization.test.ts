import { describe, expect, it } from 'vitest';
import { normalizeProjectNumber } from '../src/adapters/reporter';

describe('NIH project number normalization', () => {
  it.each([
    ['R01HL136679', 'R01HL136679'], ['5R01HL136679-05', 'R01HL136679'], ['1R01HL136679-01A1', 'R01HL136679'], [' ul1tr003142 ', 'UL1TR003142'], ['P30GM103337', 'P30GM103337']
  ])('extracts a core but preserves %s', (raw, core) => { const n = normalizeProjectNumber(raw); expect(n.raw).toBe(raw); expect(n.core).toBe(core); expect(n.candidates).toContain(core); });
  it.each(['HHSN268200900040C', 'HL136679', 'R01-HL-136679', ''])('does not invent a core for ambiguous %s', (raw) => { const n = normalizeProjectNumber(raw); expect(n.supported).toBe(false); expect(n.raw).toBe(raw); });
});
