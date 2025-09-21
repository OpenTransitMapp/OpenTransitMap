# Architecture Decision Record (ADR) 0004: Viewport Scope Provisioning (POST + scopeId)

Status: Accepted
Date: 2025-09-21

## Context
The map should subscribe to live updates only for what’s visible. Passing long tile lists via GET hits URL limits and is hard to cache coherently.

## Decision
Introduce a POST‑based scope provisioning API that mints a reusable `scopeId`:
- `POST /api/trains/scopes` with `{ cityId, tiles[] | bbox }` → normalize → store ScopeDefinition → return `ScopedTrainsFrame + scopeId`.
- Subsequent requests use `scope=<scopeId>` (`GET /api/trains`, `/api/trains/stream`).
- Retain both tile and bbox shapes; normalize to consistent precision for cacheability.

## Consequences
- Pros: Short URLs, cacheable snapshots, easy shareability, consistent filtering for deltas.
- Cons: Extra round trip to mint scope; need eviction policy for stale scopes.

## Alternatives Considered
- GET with tiles param only: Shareable but fragile due to URL length constraints.
- Server‑side per‑connection filters without `scopeId`: Harder to debug, no cache reuse.

## Implementation Notes
- Valkey keys: `viewport:<scopeId>` store scoped frames with sub‑minute TTL.
- Broadcaster validates membership against stored ScopeDefinition when routing deltas.
