SHELL := /bin/bash
.PHONY: help install start start-backend start-frontend lint typecheck build test coverage coverage-summary coverage-ci constraints ci format format-check renovate-validate up down

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
	@echo "  coverage     run tests with coverage (all workspaces)"
	@echo "  coverage-summary  print text coverage summary"
	@echo "  coverage-ci  generate coverage + append summary (for CI)"
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

coverage:
	$(YARN) coverage

coverage-summary:
	$(YARN) coverage:summary

# CI helper: run coverage per workspace and append the summary to $GITHUB_STEP_SUMMARY
# Also prints to stdout for local visibility. Keeps logic out of the workflow.
coverage-ci:
	@echo "Running coverage for backend..."
	@$(YARN) workspace @open-transit-map/backend run test:coverage | tee /dev/stderr | sed -n '/All files/,$$p' > /tmp/backend-cov-summary.txt || true
	@echo "Running coverage for types..."
	@$(YARN) workspace @open-transit-map/types run test:coverage   | tee /dev/stderr | sed -n '/All files/,$$p' > /tmp/types-cov-summary.txt || true
	@if [ -n "$$GITHUB_STEP_SUMMARY" ]; then \
	  echo "## Coverage Summary" >> "$$GITHUB_STEP_SUMMARY"; \
	  echo "" >> "$$GITHUB_STEP_SUMMARY"; \
	  echo "### Backend (@open-transit-map/backend)" >> "$$GITHUB_STEP_SUMMARY"; \
	  cat /tmp/backend-cov-summary.txt >> "$$GITHUB_STEP_SUMMARY"; \
	  echo "" >> "$$GITHUB_STEP_SUMMARY"; \
	  echo "### Types (@open-transit-map/types)" >> "$$GITHUB_STEP_SUMMARY"; \
	  cat /tmp/types-cov-summary.txt >> "$$GITHUB_STEP_SUMMARY"; \
	fi
	@# Also emit a reusable Markdown summary for PR comments
	@{
	  printf "<!-- coverage-summary: do not edit -->\n"; \
	  printf "## Coverage Summary\n\n"; \
	  printf "### Backend (@open-transit-map/backend)\n\n"; \
	  printf '```text\n'; \
	  cat /tmp/backend-cov-summary.txt; \
	  printf '\n```\n\n'; \
	  printf "### Types (@open-transit-map/types)\n\n"; \
	  printf '```text\n'; \
	  cat /tmp/types-cov-summary.txt; \
	  printf '\n```\n'; \
	} > coverage-summary.md

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
