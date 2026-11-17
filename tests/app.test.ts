import { describe, expect, it } from 'vitest';
import { app } from '../src/app';

describe('REST surface', () => {
  it('exposes health, capabilities, examples and validates seed count', async () => { const env = {} as never; expect((await app.request('/api/v1/health', {}, env)).status).toBe(200); expect((await (await app.request('/api/v1/capabilities', {}, env)).json() as { corridors: unknown[] }).corridors).toHaveLength(2); expect((await (await app.request('/api/v1/examples', {}, env)).json() as { examples: unknown[] }).examples).toHaveLength(1); expect((await app.request('/api/v1/investigate', {}, env)).status).toBe(400); });
});
