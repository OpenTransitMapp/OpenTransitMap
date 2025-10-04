# ADRs (Architecture Decision Records)

ADRs capture significant architectural decisions: the problem, the decision, tradeoffs, and how to roll it out. They live under `docs/ADRs/` and are reviewed like code.

## When to write an ADR

- Introducing a new component/process boundary or external system
- Changing cross‑service contracts or data model versions
- Significant tradeoffs (performance, cost, security, privacy)
- Anything you would want a future teammate to understand before modifying the system

## Authoring process

1. Copy the template: `docs/ADRs/0000-adr-template.md` → next number.
2. Fill Definitions first; keep Context and a strawman Decision concise.
3. Open a PR early for feedback; link related issues/PRs.
4. Add Alternatives and Consequences after initial feedback.
5. Flesh out Implementation Notes, Rollout Plan, Metrics & Observability.
6. Mark Status once consensus is reached; add Date.
7. If superseding an ADR, link both ways and update Status of the old ADR.

Style for junior readers

- Define first. Then explain What, How, Why in separate subsections.
- Add an Analogy to anchor the idea in something familiar.
- Include Mermaid diagrams (sequence/flow/component) for complex flows.

## Numbering & naming

- Use a 4‑digit sequence starting from 0001; keep it monotonically increasing.
- File name: `NNNN-descriptive-title.md` and start the title with the ADR number.

## Scope & discipline

- One decision per ADR. If scope grows, split into multiple ADRs.
- Keep the ADR focused on why and how (not full specs). Link to specs or tickets as needed.

## Current ADRs

- [0001: Record Architecture Decisions](0001-record-architecture-decisions.md) - Process for creating and maintaining ADRs
- [0002: Ingest Pipeline with Valkey Streams](0002-ingest-pipeline-valkey-streams.md) - Real-time data ingestion architecture
- [0003: Shared Schemas with TypeScript and Zod](0003-shared-schemas-typescript-zod.md) - Type-safe schema validation
- [0004: Viewport Scope Provisioning](0004-viewport-scope-provisioning.md) - Geographic scope management
- [0005: Edge Security with Envoy and OPA](0005-edge-security-envoy-opa.md) - Security and authorization
- [0006: Observability with OpenTelemetry Collector](0006-observability-otel-collector.md) - Monitoring and tracing
- [0007: Testing and Code Quality Standards](0007-testing-and-code-quality-standards.md) - Development standards for testing, documentation, and architecture

## Template

- See `docs/ADRs/0000-adr-template.md` for detailed section guidance.

---

Tips

- Prefer short initial drafts and iterate with review comments.
- Call out explicit non‑goals to avoid scope creep.
- Include a rollback plan in Rollout Plan.
- Add metrics/alerts up front to verify outcomes in production.
