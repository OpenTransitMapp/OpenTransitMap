# Architecture Decision Record (ADR) 0002: Ingest Pipeline via Valkey Streams

Status: Accepted
Date: 2025-09-21

## Context

We need a reliable, local‑friendly, and simple event transport to connect pollers, normalizers, processors, and the broadcaster. The system should support replay (short horizon), consumer groups, and easy local ops without Kafka’s operational overhead.

## Decision

Use Valkey Streams as the event bus for ingest and deltas with aggressive retention:

- Topics: `vehicles.raw`, `alerts.raw`, `stations.raw`, `events.normalized`, `state.delta`.
- Consumer groups: `normalizer`, `processor`, `broadcaster`, and future `persistence`.
- Retention: `XADD ... MAXLEN ~ N` with short replay windows (minutes) plus optional age‑based trimming.

## Consequences

- Pros: Zero external broker dependency, simple local dev (Docker Compose), supports at‑least‑once and replay, easy to shard by topic.
- Cons: Not a distributed log; limited tooling vs. Kafka; need explicit trimming and backlog monitoring.

## Alternatives Considered

- Kafka: Excellent durability and tooling but heavy for local dev and our scope.
- NATS: Lightweight pub/sub but streams and replay would require JetStream setup.

## Implementation Notes

- Namespacing and key conventions documented in Architecture (Storage Mapping).
- Metrics: backlog depth, pending per consumer group, trim rate.
