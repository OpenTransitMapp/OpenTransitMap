Renovate Policy (Plain English)

Overview
- We use Renovate to keep dependencies current across services and packages.
- Safety first: no auto‑merges, and a 3‑day stability window applies to all updates.
- Renovate opens PRs during off‑hours to minimize noise, grouped by tooling/stack.

Key Settings
- Stability window: all updates wait 5 days (stabilityDays: 5) before they’re considered.
- Ignore pre‑releases: beta/rc versions are skipped (ignoreUnstable: true).
- No auto‑merge: every PR requires review and CI to pass.
- Exact versions: rangeStrategy: bump – Renovate bumps the version numbers in package.json (no ^ or ~).
- Managers: npm (workspaces), dockerfile, docker‑compose, github‑actions.
- Post‑upgrade tasks: on Renovate branches we regenerate/dedupe the lockfile and run formatting + ESLint fixes.
  - corepack yarn install --mode=update-lockfile
  - corepack yarn dedupe --strategy highest
  - corepack yarn prettier --write '**/*.{json,md,yml,yaml}'
  - corepack yarn lint --fix
  - Note: these require post‑upgrade commands to be allowed by the Renovate host.

Grouping Rules (Why they exist)
- TypeScript toolchain
  - Packages: typescript, ts-node, @types/*, eslint, @typescript-eslint/*, prettier
  - Rationale: these move together and commonly require lockfile churn and formatting/lint runs.
  - Schedule: weekly (Saturday 04:00 local); no auto‑merge.

- Map stack
  - Packages: maplibre‑gl, @maplibre/*, vector‑tile types, pbf/vt‑pbf, geojson, @turf/*
  - Rationale: domain‑specific dependencies for the frontend mapping stack.
  - Schedule: weekly; no auto‑merge.

- Backend core libs
  - Packages: express/fastify, undici/node‑fetch, ws, dotenv, pino, zod
  - Rationale: runtime‑critical; we review these carefully.
  - Schedule: Mondays; no auto‑merge, uses stability window.

- Testing
  - Packages: jest/vitest/uvu, supertest, @testing‑library/*
  - Rationale: non‑runtime; grouped updates streamline maintenance.
  - Schedule: weekly; no auto‑merge.

- DevDependencies (weekly batch)
  - Any devDependencies not covered by above groups.
  - Rationale: lowers PR noise while keeping tooling fresh.
  - Schedule: weekly; no auto‑merge.

- Docker images
  - Dockerfile: Node base images restricted to LTS (20.x/22.x), digests pinned.
  - Docker Compose: image digests pinned and updated weekly.
  - Rationale: controlled, predictable base images with reproducible builds.

Scheduling & Noise Control
- PR limits: at most 2 per hour, 10 concurrent.
- Default schedule: weekdays 01:00–06:00 local time for non‑critical.
- Security alerts: PRs open at any time but never auto‑merge.

Developer Workflow
- When a Renovate PR opens:
  1) Read the PR title/scope to see which service/package is affected.
  2) Check the diff: manifest and lockfile; formatting/lint should already be applied.
  3) Run make ci locally if you want extra confidence.
  4) Approve/merge if green and safe; otherwise push fixes to the Renovate branch.

Future Enhancements (optional)
- Ignore pre‑releases: add "ignoreUnstable": true to avoid beta/rc updates.
- Regex manager for GitHub Actions: enforce Node LTS (20/22) in workflows.
- File matchers: add more groups if we introduce new stacks (e.g., OpenTelemetry, Valkey clients).
