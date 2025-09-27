import type { ScopeDefinition, ScopedTrainsFrame, ScopeId } from '@open-transit-map/types';

/**
 * In-memory storage for transit scopes and frames with TTL-based expiration.
 * Provides temporary storage for viewport scopes and their associated train frames.
 */
class InMemoryStore {
  /** Map storing scope definitions with their TTL expiration timestamps */
  private scopes = new Map<ScopeId, ScopeDefinition & { ttl: number }>();
  
  /** Map storing train frames with their TTL expiration timestamps */
  private frames = new Map<ScopeId, ScopedTrainsFrame & { ttl: number }>();

  /**
   * Creates a new InMemoryStore instance
   * @param defaultTtlMs - Default time-to-live in milliseconds for stored items (defaults to 2 minutes)
   */
  constructor(private readonly defaultTtlMs: number = 2 * 60 * 1000) {}

  /**
   * Creates or updates a scope definition with TTL-based expiration
   * @param id - Unique identifier for the scope
   * @param def - Scope definition containing bbox and other metadata
   * @param ttlMs - Optional custom TTL in milliseconds (defaults to store's defaultTtlMs)
   */
  upsertScope(id: ScopeId, def: ScopeDefinition, ttlMs: number = this.defaultTtlMs) {
    const ttl = Date.now() + ttlMs;
    this.scopes.set(id, { ...def, ttl });
  }

  /**
   * Retrieves a scope definition by ID if it exists and hasn't expired
   * @param id - Unique identifier for the scope
   * @returns The scope definition if found and valid, undefined if not found or expired
   */
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

  /**
   * Stores a train frame for a specific scope with TTL-based expiration
   * @param id - Scope identifier the frame belongs to
   * @param frame - Train frame data containing vehicle positions
   * @param ttlMs - Optional custom TTL in milliseconds (defaults to store's defaultTtlMs)
   */
  setFrame(id: ScopeId, frame: ScopedTrainsFrame, ttlMs: number = this.defaultTtlMs) {
    const ttl = Date.now() + ttlMs;
    this.frames.set(id, { ...frame, ttl });
  }

  /**
   * Retrieves a train frame by scope ID if it exists and hasn't expired
   * @param id - Scope identifier for the frame
   * @returns The train frame if found and valid, undefined if not found or expired
   */
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
