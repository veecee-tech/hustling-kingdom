# Hustling Kingdom

Hustling Kingdom is a mobile-first multiplayer Nigerian life, hustle and economic simulation game.

This repository is designed to be implemented incrementally with Codex using the specifications in `/docs` and the permanent engineering instructions in `AGENTS.md`.

## Documentation

Read in this order:

1. `docs/GDD.md`
2. `docs/ECONOMY.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DATABASE.md`
5. `docs/API.md`
6. `docs/SECURITY.md`
7. `docs/ROADMAP.md`
8. `AGENTS.md`

## Core Engineering Principle

The client requests actions. The server determines reality.

## V1 Stack

Vue 3 + TypeScript + Vite + Pinia + Vue Router + Tailwind CSS + Phaser

NestJS + TypeScript + PostgreSQL + Prisma + Redis + BullMQ + Socket.IO

Testing: Vitest, integration tests and Playwright.

## Development Strategy

Implement one roadmap phase at a time. Do not ask Codex to build the entire game in one run.

The first implementation target is `ROADMAP.md` Phase 0.

## Phase 0 developer setup

Prerequisites: Node.js 22.13+ on the 22 LTS line (or Node 24+), pnpm 11.25.0,
Docker with Compose, and available local ports 3000, 5173, 5432 and 6379.
Use the `packageManager` version in `package.json`; CI uses Node 22 LTS.

```sh
pnpm install
```

Copy `.env.example` to `.env` at the repository root (`Copy-Item .env.example .env`
in PowerShell, `cp .env.example .env` on Unix). Values in the example are local,
development-only credentials. Never reuse them for deployment.

```sh
docker compose up -d --wait
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

Open the web app at <http://127.0.0.1:5173>. The API listens on port 3000.
The home page checks required service readiness and offers retry when unavailable.
The web app uses only the public `VITE_API_BASE_URL`; server environment variables
are never imported into the frontend. Vite reads the root environment file.
Deployed public API URLs and web origins must use HTTPS. TLS termination belongs
to the deployment environment; Phase 0 does not deploy infrastructure.

### Database workflow

The Prisma schema contains no domain models. A reviewed, no-table baseline
migration establishes migration history without starting Phase 1. Generated
Prisma code is ignored and must be regenerated after installation/schema changes.

`pnpm prisma:migrate` applies development migrations. When adding a schema change
in a later phase, run `pnpm --filter @hk/api exec prisma migrate dev --name descriptive_name`,
review the SQL, then regenerate the client. Commit the schema and migration together.
Use `pnpm prisma:deploy` to apply committed migrations in CI/release workflows;
do not use `db push` as a deployment strategy. No seed data is needed in Phase 0.

### Quality commands

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm format:check
```

Integration tests require running PostgreSQL and Redis and the generated Prisma
client. Unit tests mock external services. Playwright starts Vite automatically
and intercepts readiness requests for deterministic browser smoke tests; live
dependency connectivity is covered separately by integration tests. CI runs all
these checks with PostgreSQL and Redis service containers.

`pnpm format` formats implementation files without rewriting the source-of-truth
specifications. Shared packages build before development, typecheck and tests.
If editing a shared package during development, rerun its build to update consumers.

### API operations

- `GET /health/live`: process liveness, independent of dependencies.
- `GET /health/ready`: PostgreSQL and Redis checks; returns 503 on failure.
- OpenAPI UI: <http://localhost:3000/api/v1/docs>.
- OpenAPI JSON: <http://localhost:3000/api/v1/docs-json>.

Health endpoints are intentionally outside `/api/v1`. Future application routes
use `/api/v1`. Every HTTP request receives a fresh server `x-request-id`, also
included in the standard error envelope. Responses and logs omit dependency
credentials and exception details. Startup requires valid configuration and
reachable dependencies. CORS accepts the single explicit `WEB_ORIGIN`.

The API client centralizes JSON, safe errors, timeouts, request IDs and optional
authorization/idempotency headers. There is no token storage, refresh or auth flow.
Socket.IO is configured only as a transport adapter, with no public gateway;
authenticated events and presence are future work. BullMQ has one infrastructure
queue, no workers and no scheduled gameplay. Phaser is deferred to Phase 20.

### Workspace

```text
apps/api               NestJS infrastructure modules and Prisma
apps/web               Vue shell, router, Pinia and typed API client
packages/shared        Public API contracts
packages/game-rules    Empty, testable deterministic-rules package boundary
packages/validation    Shared explicit-origin validation
packages/config        Public protocol constants only
infrastructure         Development infrastructure notes
```

Phase 1 authentication and all gameplay remain intentionally unimplemented.
