# OpenTransitMap

Minimal monorepo scaffold: typed backend, Vite frontend, and shared types.

## What’s Inside

- Yarn v4 workspaces (monorepo)
- Backend (Express + TypeScript) with `/healthz` and `/metrics`
- Frontend (Vite + TypeScript) placeholder app
- Shared package for types and schemas
- Optional Docker Compose with Valkey (for later state/stream work)
- Architecture docs, Privacy stub, and ADRs
- CI via GitHub Actions (lint, typecheck, build, constraints)
- Pre‑commit hooks (Husky)
- Dependency updates via Renovate (see docs/RENOVATE.md)

## Prerequisites

- Git — https://git-scm.com/downloads
- Node 20.x (via nvm) — https://nodejs.org and https://github.com/nvm-sh/nvm
  ```bash
  nvm install 20
  nvm use
  node -v   # v20.x
  ```
- Corepack (bundled with Node 20) — https://yarnpkg.com/corepack
  - Uses `packageManager` to pin Yarn (no vendored binary).
  - Verify:
    ```bash
    corepack yarn -v   # 4.3.1
    ```
- Make (required) — macOS/Linux include it; Windows use WSL or https://gnuwin32.sourceforge.net/packages/make.htm
- Docker Desktop (for Docker Compose workflows) — https://www.docker.com/products/docker-desktop/

## Quick Start

Use Make everywhere (single source of truth for local and CI):

```bash
# Install dependencies (immutable lockfile)
make install

# Start backend + frontend (dev servers)
make start
```

Once running:

- Backend: http://localhost:8080/healthz and http://localhost:8080/metrics
- Frontend: http://localhost:5173 (default Vite port)

## Monorepo Layout

```
services/
  backend/   → Express API (health + metrics)
  frontend/  → Vite placeholder app

packages/
  types/     → shared types/constants

docs/
  ARCHITECTURE.md
  PRIVACY.md
  ADRs/
```

## Editor Setup

- VS Code users: the repo recommends extensions in `.vscode/extensions.json`.
- Suggested extensions (IDs):
  - `dbaeumer.vscode-eslint`
  - `esbenp.prettier-vscode`
  - `ms-azuretools.vscode-docker`
  - `redhat.vscode-yaml`
  - `EditorConfig.EditorConfig`
  - `ms-vscode.makefile-tools`
  - `GitHub.vscode-github-actions`
  - `DavidAnson.vscode-markdownlint`

## Common Operations (Make)

- `make start` → runs each workspace’s `start` in parallel (backend + frontend)
- `make lint` → ESLint across packages
- `make typecheck` → TypeScript project references
- `make build` → build all workspaces
- `make test` → run workspace tests
- `make constraints` → enforce pinned dependency versions (no ^ or ~)
- `make ci` → constraints + lint + typecheck + build (used in CI)

What does `make start` do?

- Calls `corepack yarn workspaces foreach --all --parallel --interlaced run start` under the hood.
- Backend: Nodemon + ts-node ESM loader on port 8080.
- Frontend: Vite dev server on port 5173.
- Shared: no-op (placeholder).

Per‑package start/build scripts (examples):

- Backend (`services/backend`)
  - `yarn start` → Nodemon + ts-node on port 8080
  - `yarn build` → TypeScript build
- Frontend (`services/frontend`)
  - `yarn start` → Vite dev server (defaults to 5173)
  - `yarn build` → Production build
- Types (`packages/types`)
  - `yarn build` → TypeScript build

## API Reference

- The API surface is defined by an OpenAPI spec generated from our Zod schemas and route contracts. This spec is the source of truth.
- When the backend is running locally:
  - Spec JSON: `GET /openapi.json`
  - Swagger UI: `GET /docs`
  - Health: `GET /healthz`
  - Metrics: `GET /metrics`

Default port is `8080` (override with `PORT`). Example:

```bash
PORT=3000 corepack yarn workspace @open-transit-map/backend start
```

## Environment & Configuration

- A sample file exists at `.env.example`.
- The Docker Compose setup reads `.env` automatically; local start (`make start`) does not load `.env` by default, so export variables in your shell if needed:
  ```bash
  cp .env.example .env        # for compose
  export PORT=8080            # for local dev, if you need to override
  ```

## Docker Compose

You can run the backend and Valkey together:

```bash
make up
```

- Backend: http://localhost:8080/healthz
- Valkey: localhost:6379

Notes:

- The backend image runs in development mode using `ts-node` (no hot-reload by default).
- Adjust env via `.env` (Compose reads it automatically). Example:
  ```bash
  cp .env.example .env
  echo "PORT=8081" >> .env
  make up
  ```

## Husky Pre‑commit

Pre‑commit runs constraints, typecheck, and lint via Corepack Yarn. If hooks look like Yarn v1, ensure Node 20 is active:

```bash
nvm use
corepack yarn -v   # 4.x
```

The hook runs, in order:

- constraints → enforce pinned dependency versions (no ^ or ~)
- typecheck → TypeScript project references
- lint → ESLint across packages

## Contributing

- Read the architecture notes in `docs/ARCHITECTURE.md` and ADRs in `docs/ADRs/`.
- Before opening a PR, run: `yarn lint && yarn typecheck && yarn build`.
- We pin exact dependency versions and enforce via `yarn constraints`.
- PRs welcome! Please keep changes focused and documented.

## CI

GitHub Actions runs on push/PR using Make as the source of truth:

- `make install` then `make ci` (constraints, lint, typecheck, build)

## Testing Strategy

We maintain a layered testing approach that aims for high confidence and low flakiness:

- Unit

  - Small surfaces (functions, schemas, modules) in isolation
  - Cover both acceptance and rejection paths; assert clear error semantics

- Property‑based

  - Validate invariants with a wide range of generated inputs (see
    [property‑based testing](https://en.wikipedia.org/wiki/Property-based_testing), e.g.,
    [fast‑check](https://fast-check.dev/))
  - Constrain inputs and keep runs deterministic to avoid flakiness

- API / Integration

  - Exercise versioned endpoints (e.g., `/api/v1`) end‑to‑end at the process boundary (e.g., with
    [supertest](https://github.com/ladjs/supertest))
  - Assert [HTTP status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status), response shapes,
    and error behavior (happy/failure/edge cases)
  - Follow [“parse, don’t validate”](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/):
    parse inputs into trusted domain types (e.g., with [Zod](https://zod.dev/)), then normalize separately

- End‑to‑End (optional where valuable)
  - Validate user‑visible flows and contract consistency across services

General expectations

- Prefer [“parse, don’t validate”](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/);
  keep transformations explicit and outside schemas
- Test happy paths, edge cases, and failure modes with meaningful messages
- Keep tests deterministic and independent from external networks/resources
- Favor clarity and intent in tests over incidental implementation details

## Development Standards

We maintain high code quality through consistent standards for testing, documentation, and architecture:

### Testing Standards

- **Comprehensive Coverage**: Every new feature must include thorough tests covering happy paths, error cases, and edge conditions
- **No Duplication**: Don't test the same behavior multiple times across different test files
- **Test Isolation**: Each test should be independent and not rely on external state
- **Clear Intent**: Tests should clearly express what behavior is being verified

### Documentation Standards

- **TSDoc Comments**: All public APIs and complex business logic must be documented with clear, concise TSDoc comments
- **Examples**: Include practical usage examples in documentation
- **Error Conditions**: Document what can go wrong and when
- **Living Documentation**: Keep documentation in sync with code changes

### Architecture Standards

- **Dependency Injection**: Use constructor injection to make components testable and flexible
- **Interface Segregation**: Create small, focused interfaces rather than large ones
- **Single Responsibility**: Each component should have one clear purpose
- **Configuration**: Use external configuration rather than hardcoded values

For detailed guidelines, see [ADR 0007: Testing and Code Quality Standards](docs/ADRs/0007-testing-and-code-quality-standards.md).

## Test Coverage

Generate coverage locally (all workspaces) and open the HTML report per package:

```bash
# Run coverage across workspaces
make coverage

# Open reports
open services/backend/coverage/index.html
open packages/types/coverage/index.html
```

In CI, the Test job:

- Prints a coverage summary into the job summary
- Uploads HTML and lcov reports as artifacts for each workspace

You can also print a concise text summary locally:

```bash
make coverage-summary
```

## Makefile

The Makefile is required and the single source of truth for local and CI operations. See available commands with `make help`.

## Docs

- Architecture: `docs/ARCHITECTURE.md`
- ADRs: `docs/ADRs/`
- Privacy: `docs/PRIVACY.md`

## License

MIT — see `LICENSE`.
