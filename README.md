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

## GitHub
```bash
git init
git add .
git commit -m "chore: initial scaffold"
git branch -M main
git remote add origin <YOUR_GITHUB_URL>
git push -u origin main
```
