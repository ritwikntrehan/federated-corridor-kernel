import { describe, expect, it } from 'vitest';
import { OpenAlexAdapter } from '../src/adapters/openalex';
import { ClinicalTrialsAdapter, references } from '../src/adapters/clinicaltrials';
import { ReporterAdapter } from '../src/adapters/reporter';
import { MemoryCache } from '../src/kernel';

const live = process.env.LIVE_SMOKE === '1' ? describe : describe.skip;
live('current upstream smoke', () => {
  it('resolves every required provider and fails honestly when one is unavailable', async () => { const cache = new MemoryCache(); const oa = await new OpenAlexAdapter(fetch, cache).getWorkByIdOrPmid('36223105'); expect(oa.record.id).toContain('W4304757292'); const projects = await new ReporterAdapter(fetch, cache).findProjects('R01HL136679'); expect(projects.records.some((p) => p.core_project_num === 'R01HL136679')).toBe(true); const trial = await new ClinicalTrialsAdapter(fetch, cache).getStudy('NCT01206062'); expect(references(trial.record).some((r) => r.pmid === '36223105')).toBe(true); }, 30000);
});
