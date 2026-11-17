import { describe, expect, it } from 'vitest';
import { OpenAlexAdapter, reconstructAbstract } from '../src/adapters/openalex';
import { OpenFdaAdapter } from '../src/adapters/openfda';
import { UsptoAdapter } from '../src/adapters/uspto';
import { investigateEntity } from '../src/investigate';
import { MemoryCache } from '../src/kernel';
import { fixtureFetch, openalex } from './helpers';

describe('v0.3 five-country instrument', () => {
  it('reconstructs abstracts and requires exact bounded NCT tokens', async () => {
    expect(reconstructAbstract({ NCT01206062: [1], Trial: [0], ended: [2] })).toBe('Trial NCT01206062 ended');
    const good = { ...openalex, id: 'https://openalex.org/W1', title: 'A result', abstract_inverted_index: { Trial: [0], NCT01206062: [1] } };
    const falsePositive = { ...openalex, id: 'https://openalex.org/W2', title: 'NCT012060620 is not the trial', abstract_inverted_index: null };
    const fetcher: typeof fetch = async () => Response.json({ results: [good, falsePositive] });
    const result = await new OpenAlexAdapter(fetcher, new MemoryCache()).findNctMentions('NCT01206062');
    expect(result.matches.map((match) => match.record.id)).toEqual(['https://openalex.org/W1']); expect(result.telemetry.rejected_nonmatches).toBe(1); expect(result.telemetry.missing_abstracts).toBe(1);
  });
  it('parses the verified patent snapshot and exact NIH acknowledgment without inventing SPRINT links', () => {
    const adapter = new UsptoAdapter(); expect(adapter.getByPatentNumber('10,407,381')?.data_mode).toBe('verified_public_snapshot'); expect(adapter.findByGovernmentAward('R01 MH99993').map((patent) => patent.patent_number)).toEqual(['US10407381B2']); expect(adapter.findByGovernmentAward('R01HL136679')).toEqual([]);
  });
  it('preserves drug approval, label, and 510(k) semantics independently', async () => {
    const fetcher: typeof fetch = async (input) => { const url = String(input); if (url.includes('drugsfda')) return Response.json({ results: [{ application_number: 'NDA020895', sponsor_name: 'Sponsor', products: [{ brand_name: 'Example', active_ingredients: [{ name: 'INGREDIENT' }] }], submissions: [{ submission_status: 'AP', submission_status_date: '19980327' }] }] }); if (url.includes('device/510k')) return Response.json({ results: [{ k_number: 'K230233', applicant: 'Device Co', device_name: 'Example Device', decision_date: '20230630', decision_code: 'SESE' }] }); return Response.json({ results: [{ set_id: 'label-1', openfda: { application_number: ['NDA020895'], brand_name: ['Example'], generic_name: ['example'], substance_name: ['INGREDIENT'] }, clinical_studies: ['NCT01206062'] }] }); };
    const adapter = new OpenFdaAdapter(fetcher, new MemoryCache()); const drug = (await adapter.get('drug_application', 'NDA020895')).records[0]!; const label = (await adapter.get('drug_label', 'NDA020895')).records[0]!; const device = (await adapter.get('device_510k', 'K230233')).records[0]!;
    expect([drug.record_kind, label.record_kind, device.record_kind]).toEqual(['drug_application', 'drug_label', 'device_510k']); expect(label.nct_mentions).toEqual(['NCT01206062']); expect(device.k_number).toBe('K230233');
  });
  it('supports trial, publication, NIH project, patent, FDA product, and topic entries', async () => {
    const base = { fetch: fixtureFetch().fn, cache: new MemoryCache(), now: () => new Date('2026-11-17T00:00:00Z') };
    expect((await investigateEntity({ entry_type: 'trial', entry_id: 'NCT01206062', max_hops: 0, providers: ['clinicaltrials.gov'], max_nodes: 10, include_hypothesis_edges: false }, base)).graph.nodes[0]?.country).toBe('clinicaltrials.gov');
    expect((await investigateEntity({ entry_type: 'publication', entry_id: '36223105', max_hops: 0, providers: ['openalex'], max_nodes: 10, include_hypothesis_edges: false }, base)).summary.scholarly_works).toBe(1);
    expect((await investigateEntity({ entry_type: 'nih_project', entry_id: 'R01HL136679', max_hops: 0, providers: ['nih-reporter'], max_nodes: 40, include_hypothesis_edges: false }, base)).summary.nih_project_year_records).toBeGreaterThan(0);
    expect((await investigateEntity({ entry_type: 'patent', entry_id: 'US10000000B2', max_hops: 0, providers: ['uspto'], max_nodes: 10, include_hypothesis_edges: false }, base)).summary.patents).toBe(1);
    const fdaFetch: typeof fetch = async () => Response.json({ results: [{ k_number: 'K230233', applicant: 'Device Co', device_name: 'Example Device', decision_date: '20230630', decision_code: 'SESE' }] });
    expect((await investigateEntity({ entry_type: 'fda_product', entry_id: 'K230233', max_hops: 0, providers: ['openfda'], max_nodes: 10, include_hypothesis_edges: false }, { ...base, fetch: fdaFetch })).summary.device_clearances).toBe(1);
    expect((await investigateEntity({ entry_type: 'topic', query: 'blood pressure', max_hops: 0, providers: ['openalex'], max_nodes: 10, include_hypothesis_edges: false }, base)).summary.scholarly_works).toBe(1);
  });
});
