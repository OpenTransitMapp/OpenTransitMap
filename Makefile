SHELL := /bin/bash
.PHONY: help install start start-backend start-frontend lint typecheck build test constraints ci format format-check renovate-validate up down

# Always use Corepack to run Yarn (no global Yarn, no vendored yarnPath)
YARN := corepack yarn

help:
	@echo "Targets:"
	@echo "  install      $(YARN) install --immutable"
	@echo "  start        $(YARN) start (backend + frontend)"
	@echo "  start-backend   start only backend workspace"
	@echo "  start-frontend  start only frontend workspace"
	@echo "  lint         eslint across packages"
	@echo "  typecheck    tsc -b (project refs)"
	@echo "  build        build all workspaces"
	@echo "  test         run workspace tests"
	@echo "  constraints  enforce pinned dependency versions"
	@echo "  ci           constraints + lint + typecheck + build"
	@echo "  format       run Prettier on JSON/MD/YAML"
	@echo "  format-check check formatting (no changes)"
	@echo "  renovate-validate  validate renovate.json via Docker"
	@echo "  up           docker compose up --build"
	@echo "  down         docker compose down -v"

install:
	$(YARN) install --immutable

start:
	$(YARN) start

start-backend:
	$(YARN) workspace @open-transit-map/backend start

start-frontend:
	$(YARN) workspace @open-transit-map/frontend start

lint:
	$(YARN) lint

typecheck:
	$(YARN) typecheck

build:
	$(YARN) build

test:
	$(YARN) test

constraints:
	$(YARN) constraints

renovate-validate:
	npx --yes --package renovate -- renovate-config-validator --strict

format:
	$(YARN) format

format-check:
	$(YARN) format:check

up:
	docker compose up --build

down:
	docker compose down -v
