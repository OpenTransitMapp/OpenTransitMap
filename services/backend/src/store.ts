import type { ScopeDefinition, ScopedTrainsFrame, ScopeId } from '@open-transit-map/types';

class InMemoryStore {
  private scopes = new Map<ScopeId, ScopeDefinition & { ttl: number }>();
  private frames = new Map<ScopeId, ScopedTrainsFrame & { ttl: number }>();

  constructor(private readonly defaultTtlMs: number = 2 * 60 * 1000) {}

  upsertScope(id: ScopeId, def: ScopeDefinition, ttlMs: number = this.defaultTtlMs) {
    const ttl = Date.now() + ttlMs;
    this.scopes.set(id, { ...def, ttl });
  }

  getScope(id: ScopeId): ScopeDefinition | undefined {
    const entry = this.scopes.get(id);
    if (!entry) return undefined;
    if (entry.ttl < Date.now()) {
      this.scopes.delete(id);
      return undefined;
    }
    const { ttl, ...rest } = entry;
    return rest;
  }

  setFrame(id: ScopeId, frame: ScopedTrainsFrame, ttlMs: number = this.defaultTtlMs) {
    const ttl = Date.now() + ttlMs;
    this.frames.set(id, { ...frame, ttl });
  }

  getFrame(id: ScopeId): ScopedTrainsFrame | undefined {
    const entry = this.frames.get(id);
    if (!entry) return undefined;
    if (entry.ttl < Date.now()) {
      this.frames.delete(id);
      return undefined;
    }
    const { ttl, ...rest } = entry;
    return rest as ScopedTrainsFrame;
  }
}

export const store = new InMemoryStore();
