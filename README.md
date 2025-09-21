# OpenTransitMap

A minimal monorepo scaffold for OpenTransitMap.

## What’s inside
- **Yarn workspaces** (monorepo)
- **Backend** (Express + TS) with `/healthz` + `/metrics`
- **Frontend** (Vite + TS) placeholder
- **Shared** package for types
- **Docker Compose** for backend + valkey (later use)
- **Docs** (Architecture, Privacy, ADRs template)
- **CI** via GitHub Actions
- **Pre-commit hooks** (Husky)

## Quick start
```bash
# Node >= 20.x required
corepack enable
corepack prepare yarn@4.3.1 --activate

yarn install
yarn dlx husky init
yarn dev
```

## Prerequisites
- Node 20.x (recommended via nvm)
  ```bash
  nvm install 20
  nvm use
  node -v   # v20.x
  ```
- Yarn 4 via Corepack (repo pins to `yarn@4.3.1` using `packageManager`)
  ```bash
  corepack enable
  corepack prepare yarn@4.3.1 --activate
  yarn -v    # 4.3.1
  ```
  Optional (vendored Yarn):
  ```bash
  # Creates .yarn/releases/yarn-4.3.1.cjs and updates .yarnrc.yml
  corepack yarn set version 4.3.1
  ```

## Installation
We pin exact dependency versions and enforce an immutable lockfile.
```bash
yarn install --immutable
yarn constraints   # verify no semver ranges (",^,~") are used
```

## Troubleshooting
- Error referencing `.yarn/releases/yarn-4.3.1.cjs`:
  - Cause: `yarnPath` points to a vendored Yarn binary that isn’t present.
  - Fix: Either remove `yarnPath` (Corepack path) or vendor Yarn:
    ```bash
    # Corepack path (no vendored Yarn)
    git restore .yarnrc.yml   # if it contained yarnPath
    corepack enable && corepack prepare yarn@4.3.1 --activate

    # OR vendor Yarn into the repo
    corepack yarn set version 4.3.1
    git add .yarnrc.yml .yarn/releases/yarn-4.3.1.cjs
    ```
- Pre-commit uses the repo’s Node 20 + Corepack Yarn:
  - If hooks fail with Yarn v1 output, ensure:
    ```bash
    nvm use
    corepack enable
    yarn -v   # 4.x
    ```


## Structure
```
packages/
  backend/   → Express API with health + metrics
  frontend/  → Vite placeholder
  shared/    → types/constants

docs/
  ARCHITECTURE.md
  PRIVACY.md
  ADRs/
```
