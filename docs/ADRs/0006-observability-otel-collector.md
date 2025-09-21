# Architecture Decision Record (ADR) 0006: Observability via OpenTelemetry Collector

Status: Proposed
Date: 2025-09-21

## Context
We need end‑to‑end traces, metrics, and logs across frontend, backend, ingest, cache, and broadcaster with vendor flexibility and easy local runs.

## Decision
Standardize on OpenTelemetry SDKs with an OTel Collector in Compose/K8s to fan out to:
- Tempo/Jaeger (traces), Prometheus (metrics), Loki (logs). Grafana as the single pane of glass.
- W3C trace context propagated across HTTP, WS/SSE, and background jobs.

## Consequences
- Pros: Vendor‑neutral, consistent telemetry model, clear upgrade path.
- Cons: Some upfront wiring; dashboards and alerts require iteration.

## Alternatives Considered
- Service‑specific agents (e.g., language APMs): Faster initial value but lock‑in and mixed models.
- No centralized collector: Simpler, but harder to switch vendors and correlate signals.

## Implementation Notes
- Span and RED metrics coverage defined per service; log correlation via trace IDs.
- Opt‑out via `OTEL_SDK_DISABLED=true` for privacy/local scenarios.
