# Architecture Decision Record (ADR) 0005: Edge Security with Envoy + OPA

Status: Proposed
Date: 2025-09-21

## Context
Public APIs require authentication, authorization, rate limiting, and consistent identity propagation without coupling application code to vendor SDKs.

## Decision
Adopt Envoy as the edge/sidecar proxy with:
- JWT validation and identity header injection (`x-sub`, `x-scope`, `x-tier`, `x-trace-id`).
- External authorization via OPA for fine‑grained policy decisions.
- Global/per‑subject rate limits via Envoy RateLimit service.
- Backend services trust only Envoy‑provided headers; local dev profile can simulate headers.

## Consequences
- Pros: Centralized, language‑agnostic guardrails; clean separation of concerns.
- Cons: Additional infra to run/manage; policy testing discipline required.

## Alternatives Considered
- App‑level middleware only: Faster to start, but inconsistent across services and harder to audit.
- API gateways (managed): Viable later; keep portable by standardizing on Envoy semantics now.

## Implementation Notes
- Secrets via file mounts; shared secret poller hot‑reloads values.
- Trace/metrics headers propagate through Envoy to keep observability intact.
