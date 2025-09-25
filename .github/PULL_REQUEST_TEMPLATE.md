## Title

Short, action‑oriented title. Include a risk tag prefix, enforced by CI:

- [low-risk] Your concise title here
- [med-risk] Your concise title here
- [high-risk] Your concise title here

Example: `[low-risk] fix: tighten bbox schema and add tests`

## What

Describe exactly what changed. Focus on behavior and user‑visible effects.

- Schemas: list any added/updated/removed Zod schemas (paths, names)
- Contracts: note any new fields, stricter refinements, or strict() changes
- Utils: list new helpers (e.g., quantization/clamping/keys) and where they’re used

## Why

Problem/motivation and constraints. Link issues/ADRs if applicable.

- Contracts: why these schemas/fields/constraints are needed now
- Validation vs normalization: what is rejected vs cleaned later (if applicable)
- Alternatives considered (brief) if schemas could have evolved differently

## Scope of Change

- Services/Packages touched: (e.g., `services/backend`, `packages/types`)
- APIs/Contracts: (new/changed/unchanged). If changed, link to schema diff.
- Data/Storage: (none/changed/migration?)

## Risk & Impact

- Risk level: [ ] Low [ ] Medium [ ] High
- Backwards compatibility: [ ] Yes [ ] No (explain breaking changes below)
- Performance implications: (none/describe)
- Security/Privacy considerations: (none/describe)

## How I Tested

Select all that apply and add details (commands, files, cases). Prefer Make targets.

- [ ] Unit tests
  - Files/areas:
  - Command(s): `make test` (or workspace‑specific)
- [ ] Property‑based tests (fast‑check)
  - Files/areas:
  - Command(s): `make test` (optionally note seeds)
- [ ] Integration tests (services together)
  - Scope:
  - Command(s): `make up` (and `make down`), plus verification steps
- [ ] End‑to‑End (E2E) / manual flows
  - Steps (bullet points):
  - Command(s): `make start` (dev) or `make up` (compose)
  - Expected vs actual results:
- [ ] Performance checks (if relevant)
  - Method/metrics:
  - Findings:
- [ ] Screenshots / logs / sample requests & responses (attach below)

## Rollout Plan

- Deployment steps or flags/toggles
- Observability: metrics/logs/traces added/updated
- Rollback: how to revert safely

## Breaking Changes (if any)

- Describe the break and migration path. Call out client actions needed.

## Checklist

- [ ] Linked issue(s) and/or ADR(s)
- [ ] Updated docs (README/Architecture/ADRs) if behavior or contracts changed
- [ ] Added/updated tests (cover happy paths, edge cases, and failures)
- [ ] Ran `make ci` locally (constraints, lint, typecheck, build all green)
- [ ] No secrets/PII added; configs documented
- [ ] Observability updated (metrics/logging/tracing) where relevant
- [ ] Backwards compatibility considered (or documented as breaking)

## Reviewer Notes

Anything that will help reviewers (focus areas, follow‑ups, known gaps).
