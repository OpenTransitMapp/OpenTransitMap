# Architecture Decision Record (ADR) 0003: Shared Schemas with TypeScript + Zod

Status: Accepted
Date: 2025-09-21

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
