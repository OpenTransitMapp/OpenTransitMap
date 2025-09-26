import { describe, it, expect } from 'vitest';
import type { ScopeDefinition, ScopedTrainsFrame, ScopeId } from '@open-transit-map/types';
import { store } from '../../src/store.js';

const sid = (s: string) => s as unknown as ScopeId;

describe('InMemoryStore TTL behavior', () => {
  it('getScope returns value before TTL and undefined after expiry', async () => {
    const id = sid('scope-ttl-test');
    const def: ScopeDefinition = {
      id,
      cityId: 'nyc',
      bbox: { south: 0, west: 0, north: 1, east: 1 },
      createdAt: new Date().toISOString(),
    };

    // Not expired
    store.upsertScope(id, def, 50);
    expect(store.getScope(id)).toEqual(def);

    // Expire quickly
    store.upsertScope(id, def, 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(store.getScope(id)).toBeUndefined();
  });

  it('getFrame returns value before TTL and undefined after expiry', async () => {
    const id = sid('frame-ttl-test');
    const frame: ScopedTrainsFrame = {
      scopeId: id,
      cityId: 'nyc',
      bbox: { south: 0, west: 0, north: 1, east: 1 },
      at: new Date().toISOString(),
      checksum: undefined,
      vehicles: [],
    };

    // Not expired
    store.setFrame(id, frame, 50);
    expect(store.getFrame(id)).toEqual(frame);

    // Expire quickly
    store.setFrame(id, frame, 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(store.getFrame(id)).toBeUndefined();
  });

  it('returns undefined for unknown ids (no entry)', () => {
    expect(store.getScope(sid('does-not-exist'))).toBeUndefined();
    expect(store.getFrame(sid('does-not-exist'))).toBeUndefined();
  });
});
