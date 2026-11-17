import { z } from 'zod';
import { BoundarySchemas, DiplomaticEnvelopeSchema, type BoundaryName, type DiplomaticEnvelope, type EvidenceGraph } from './contracts';

export type Fetcher = typeof fetch;
export interface CacheLike { get(key: string): Promise<string | null>; put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>; }

export class MemoryCache implements CacheLike {
  private readonly values = new Map<string, { value: string; expires: number }>();
  constructor(private readonly max = 100) {}
  async get(key: string) { const hit = this.values.get(key); if (!hit || hit.expires < Date.now()) { this.values.delete(key); return null; } return hit.value; }
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    if (this.values.size >= this.max) this.values.delete(this.values.keys().next().value ?? '');
    this.values.set(key, { value, expires: Date.now() + (options?.expirationTtl ?? 900) * 1000 });
  }
}

export async function cachedJson<T>(cache: CacheLike, key: string, ttl: number, request: () => Promise<T>): Promise<{ data: T; cache: 'hit' | 'miss' }> {
  const hit = await cache.get(key);
  if (hit) return { data: JSON.parse(hit) as T, cache: 'hit' };
  const data = await request();
  await cache.put(key, JSON.stringify(data), { expirationTtl: ttl });
  return { data, cache: 'miss' };
}

export interface CorridorContext { fetch: Fetcher; cache: CacheLike; now: () => Date; signal?: AbortSignal; }
export interface Corridor<I = unknown, O = unknown> {
  id: string;
  title: string;
  inputBoundary: BoundaryName;
  outputBoundary: BoundaryName;
  matchMethods: string[];
  sideEffects: 'none';
  limits: { maxInput: number; maxOutput: number; timeoutMs: number; requestsPerSecond?: number };
  traverse(input: I, context: CorridorContext): Promise<DiplomaticEnvelope<O>>;
}

export class Registry {
  private readonly corridors = new Map<string, Corridor>();
  register(corridor: Corridor) { if (this.corridors.has(corridor.id)) throw new Error(`duplicate corridor: ${corridor.id}`); this.corridors.set(corridor.id, corridor); return this; }
  get(id: string) { const c = this.corridors.get(id); if (!c) throw new Error(`unknown corridor: ${id}`); return c; }
  list() { return [...this.corridors.values()]; }
  compose(ids: string[]) {
    const chain = ids.map((id) => this.get(id));
    for (let i = 0; i < chain.length - 1; i++) if (chain[i]!.outputBoundary !== chain[i + 1]!.inputBoundary) {
      throw new Error(`incompatible boundaries: ${chain[i]!.outputBoundary} -> ${chain[i + 1]!.inputBoundary}`);
    }
    return chain;
  }
  capabilities() {
    return { schema_version: '0.3', countries: ['openalex', 'nih-reporter', 'clinicaltrials.gov', 'uspto', 'openfda'], boundaries: Object.keys(BoundarySchemas), corridors: this.list().map(({ traverse: _t, ...c }) => c) };
  }
}

export function validateInput(boundary: BoundaryName, value: unknown) { return BoundarySchemas[boundary].safeParse(value); }

export function makeEnvelope<T>(input: {
  payload: T; status?: 'complete' | 'partial' | 'failed'; passport: DiplomaticEnvelope<T>['passport']; customs: DiplomaticEnvelope<T>['customs_declaration'];
  interpreter?: DiplomaticEnvelope<T>['resident_interpreter']; evidence?: EvidenceGraph; errors?: DiplomaticEnvelope<T>['errors']; dataMode?: DiplomaticEnvelope<T>['data_mode'];
}): DiplomaticEnvelope<T> {
  const envelope = { schema_version: '0.1' as const, envelope_id: crypto.randomUUID(), status: input.status ?? 'complete', data_mode: input.dataMode ?? (input.passport.hops.some((hop) => hop.request.method === 'SNAPSHOT') ? 'verified_public_snapshot' as const : 'live_api' as const), payload: input.payload, passport: input.passport,
    customs_declaration: input.customs, resident_interpreter: input.interpreter ?? [], evidence: input.evidence ?? { nodes: [], edges: [] }, errors: input.errors ?? [] };
  DiplomaticEnvelopeSchema.parse(envelope);
  return envelope;
}

export function identity<T>(envelope: DiplomaticEnvelope<T>): DiplomaticEnvelope<T> {
  return structuredClone(envelope);
}

export function checkIdentityAgreement(a: { id: string }, b: { id: string }) {
  return a.id === b.id ? { state: 'agreement' as const, id: a.id } : { state: 'conflict' as const, claims: [a.id, b.id] };
}

export async function bounded<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms); })]); }
  finally { if (timer) clearTimeout(timer); }
}

export function parseJsonBody<T>(schema: z.ZodType<T>, value: unknown): T { return schema.parse(value); }
