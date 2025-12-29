# =============================================================================
# YG App Node - Development Commands
# =============================================================================

.PHONY: help install dev build test lint format check clean
.PHONY: db-up db-down db-reset db-studio db-migrate
.PHONY: docker-up docker-down docker-logs

# Default target
.DEFAULT_GOAL := help

# Colors
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

# Help command
help: ## Show this help message
	@echo "$(CYAN)YG App Node Development Commands$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'

# =============================================================================
# Development
# =============================================================================

install: ## Install all dependencies
	pnpm install

dev: ## Start development servers (backend + frontend)
	pnpm run dev

dev-backend: ## Start only backend server
	pnpm run dev:backend

dev-frontend: ## Start only frontend server
	pnpm run dev:frontend

# =============================================================================
# Build & Test
# =============================================================================

build: ## Build all packages
	pnpm run build

test: ## Run tests
	pnpm run test

test-run: ## Run tests once (no watch)
	pnpm run test:run

test-coverage: ## Run tests with coverage
	pnpm run test:coverage

# =============================================================================
# Code Quality
# =============================================================================

lint: ## Run ESLint
	pnpm run lint

lint-fix: ## Run ESLint with auto-fix
	pnpm run lint:fix

format: ## Format code with Prettier
	pnpm run format

format-check: ## Check code formatting
	pnpm run format:check

typecheck: ## Run TypeScript type checking
	pnpm run typecheck

check: ## Run all checks (format, lint, typecheck)
	pnpm run check

# =============================================================================
# Database
# =============================================================================

db-generate: ## Generate Drizzle migrations
	pnpm run db:generate

db-migrate: ## Run database migrations
	pnpm run db:migrate

db-push: ## Push schema changes to database
	pnpm run db:push

db-studio: ## Open Drizzle Studio
	pnpm run db:studio

# =============================================================================
# Docker
# =============================================================================

docker-up: ## Start Docker services (Postgres, Redis, Langfuse)
	docker compose up -d

docker-down: ## Stop Docker services
	docker compose down

docker-logs: ## View Docker logs
	docker compose logs -f

docker-reset: ## Reset Docker volumes (WARNING: deletes data)
	docker compose down -v
	docker compose up -d

# =============================================================================
# Setup & Cleanup
# =============================================================================

setup: install docker-up ## Full setup: install deps and start services
	@echo "$(GREEN)✓ Setup complete!$(RESET)"
	@echo "  Run 'make dev' to start development servers"

clean: ## Clean build artifacts and caches
	pnpm run clean
	rm -rf node_modules/.cache

reset: clean ## Reset project (clean + reinstall)
	rm -rf node_modules packages/*/node_modules
	pnpm install

# =============================================================================
# Utilities
# =============================================================================

env: ## Copy .env.example to .env (if not exists)
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN)✓ Created .env file$(RESET)"; \
	else \
		echo "$(YELLOW).env already exists$(RESET)"; \
	fi
