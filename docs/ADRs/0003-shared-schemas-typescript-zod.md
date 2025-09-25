# Architecture Decision Record (ADR) 0003: Shared Schemas with TypeScript + Zod

Status: Accepted
Date: 2025-09-21

## TL;DR

- Define cross‑service contracts as Zod schemas in `packages/types`; derive TS types via `z.infer`.
- Validate at boundaries (ingest, before hot‑state write, before emitting deltas) and typecheck everywhere.
- Version payload envelopes via `schemaVersion` for safe evolution.

## Definitions

- Schema (Zod): Runtime validation definition used to parse/check data at boundaries and to derive TS types.
- Inferred Type: `z.infer<typeof Schema>` produces the static TypeScript type from a Zod schema.
- Envelope: Versioned wrapper that carries a `schemaVersion` alongside the payload for safe evolution.
- Versioning: Policy to add fields additively and bump envelope versions for breaking changes; older consumers continue to parse prior versions.

## Context

We want strict, runtime‑validated contracts across backend, broadcaster, and frontend while staying TypeScript‑first. Schemas must be sharable, versioned, and enforceable in CI.

## Decision

Define all cross‑service contracts in `packages/types/src/schemas/` using Zod and export types via `z.infer`.

- Schemas: `TransitEvent`, `VehicleState`, `VehicleDelta`, `TrainsFrame`, `ScopedTrainsFrame`, `ViewportRequest`, `ScopeDefinition`.
- Include `schemaVersion` in envelopes; evolve schemas with additive changes; gate breaking changes behind new versions.

## Consequences

- Pros: Single source of truth, runtime validation, strong typing, faster onboarding.
- Cons: Some duplication vs. pure OpenAPI/JSON Schema; require discipline to bump versions.

## Alternatives Considered

- JSON Schema + codegen: Broader ecosystem, but heavier toolchain and less ergonomic in TS.
- Protobuf: Great for binary efficiency, but adds complexity and schema registry overhead.

## Implementation Notes

- CI: lint + typecheck shared first; consumers pin schema versions.
- Validation boundaries: normalize at ingest; validate before writing hot state and before emitting deltas.

### Normalization vs Validation

- Validation (public inputs): schemas reject invalid data and never silently transform it. Example: out‑of‑bounds coordinates or invalid bbox shapes fail with clear error messages.
- Normalization (internal ingest): provider data may be clamped or cleaned, with metrics emitted when adjustments occur. Example: clamp coordinates to Web Mercator bounds, quantize bboxes before computing scope keys.
- Rationale: callers get predictable behavior at the API boundary, while ingest can be resilient to upstream quirks without corrupting downstream state.

## What / Why / How

### What

Shared Zod schemas serve as the single source of truth for our domain (events, frames, viewport). Types are inferred for compile‑time safety.

### Why

- Runtime validation catches bad inputs at boundaries, preventing corrupt state and hard‑to‑debug errors downstream.
- Co‑locating schemas with code is simpler than separate schema registries for our scope; Zod ergonomics fit TS well.

### How

- Author schemas with `.strict()` objects and branded primitives (e.g., `Id`, `Latitude`).
- Export types via `z.infer`; consumers import types, not shapes.
- Evolve via envelope `schemaVersion` and additive changes; bump version for breaking changes.

### Analogy

Schemas are blueprints; `z.infer` is the parts list. Builders (services) check blueprints at the door to ensure only valid parts enter the workshop.
