SHELL := /bin/bash
.PHONY: help install start lint typecheck build test constraints ci format format-check up down

# Always use Corepack to run Yarn (no global Yarn, no vendored yarnPath)
YARN := corepack yarn

help:
	@echo "Targets:"
	@echo "  install      $(YARN) install --immutable"
	@echo "  start        $(YARN) start (backend + frontend)"
	@echo "  lint         eslint across packages"
	@echo "  typecheck    tsc -b (project refs)"
	@echo "  build        build all workspaces"
	@echo "  test         run workspace tests"
	@echo "  constraints  enforce pinned dependency versions"
	@echo "  ci           constraints + lint + typecheck + build"
	@echo "  format       run Prettier on JSON/MD/YAML"
	@echo "  format-check check formatting (no changes)"
	@echo "  up           docker compose up --build"
	@echo "  down         docker compose down -v"

install:
	$(YARN) install --immutable

start:
	$(YARN) start

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

ci:
	$(YARN) constraints && $(YARN) lint && $(YARN) typecheck && $(YARN) build

format:
	$(YARN) format

format-check:
	$(YARN) format:check

up:
	docker compose up --build

down:
	docker compose down -v
