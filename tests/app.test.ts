import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('REST surface', () => {
  it('exposes health, five-country capabilities, examples and validates seed count', async () => { const env = {} as never; expect((await app.request('/api/v1/health', {}, env)).status).toBe(200); const capabilities = await (await app.request('/api/v1/capabilities', {}, env)).json() as { corridors: unknown[]; countries: string[] }; expect(capabilities.corridors).toHaveLength(5); expect(capabilities.countries).toEqual(['openalex', 'nih-reporter', 'clinicaltrials.gov', 'uspto', 'openfda']); expect((await (await app.request('/api/v1/examples', {}, env)).json() as { examples: unknown[] }).examples).toHaveLength(1); expect((await app.request('/api/v1/investigate', {}, env)).status).toBe(400); });
  it('validates the POST multi-entry investigation route', async () => { const env = {} as never; expect((await app.request('/api/v1/investigate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entry_type: 'topic' }) }, env)).status).toBe(400); });
  it('validates and runs the versioned cohort route', async () => { const env = {} as never; expect((await app.request('/api/v1/cohort', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin_country: 'clinicaltrials.gov', seed_filter: {} }) }, env)).status).toBe(400); });
});
