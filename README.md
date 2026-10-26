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

Phase 0 provides the foundation. Phase 1 adds account authentication. Phase 2 adds character identity and onboarding, without economy state.

## Developer setup

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

The Prisma schema contains users, authentication sessions, characters and character
stats. The Phase 2 character migration preserves existing users and sessions. Generated
Prisma code is ignored and must be regenerated after installation/schema changes.

`pnpm prisma:migrate` applies development migrations. When adding a schema change
in a later phase, run `pnpm --filter @hk/api exec prisma migrate dev --name descriptive_name`,
review the SQL, then regenerate the client. Commit the schema and migration together.
Use `pnpm prisma:deploy` to apply committed migrations in CI/release workflows;
do not use `db push` as a deployment strategy. Registration replaces any need for seeded credentials.

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
client. Unit tests mock external services. Playwright starts dedicated API/web servers
on ports 3100/5174 and runs real authentication and mobile character-onboarding journeys with randomized identities.
Readiness-only browser smoke tests intercept their infrastructure requests.
Authentication integration tests use Redis database 1; Playwright uses database 2.
Reserve both for this project's tests. PostgreSQL fixtures use randomized identities;
integration fixtures are removed after tests, while browser fixtures remain as test accounts.
CI runs these same suites with PostgreSQL and Redis service containers.

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

The API client centralizes JSON, safe errors, timeouts, request IDs,
authorization/idempotency headers and coordinated session refresh.
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

## Authentication development notes

After updating an existing checkout, add the auth variables from `.env.example`,
then run `pnpm install`, `pnpm prisma:generate` and `pnpm prisma:migrate`.
Use `http://127.0.0.1` consistently for the web app and API; mixing `localhost`
and `127.0.0.1` breaks the same-site refresh cookie.

- `JWT_ACCESS_SECRET`: supplied signing secret, at least 32 bytes. The example is
  a public development fixture which production configuration explicitly rejects.
- `JWT_ACCESS_TTL_SECONDS`: 600 by default, allowed range 30–900.
- `REFRESH_TOKEN_TTL_SECONDS`: absolute session lifetime; defaults to seven days.
- `AUTH_RATE_LIMIT` / `AUTH_RATE_WINDOW_SECONDS`: attempts per endpoint/IP/window,
  default 30 attempts in 60 seconds; backed by Redis and fails closed on outage.

Open `/register`, `/login` or the protected `/account` page. The access token stays
in memory; the HttpOnly refresh cookie restores the session after reload.
Production uses Secure, SameSite=Strict cookies and requires same-site HTTPS web/API
origins. Auth POSTs require the configured `Origin` and `X-HK-Client: web` header;
the central browser client sets the custom header and includes cookies explicitly.
CLI/API clients must supply those headers too. OpenAPI describes the requests.

Tests participate in the existing `pnpm test`, `pnpm test:integration` and
`pnpm test:e2e` commands. Browser traces are disabled so credentials do not enter
trace artifacts. See [authentication design](docs/AUTHENTICATION.md) for session,
revocation and deployment details.

Phase 2 character identity is implemented; economy and subsequent gameplay remain deferred.

### Character creation

Apply committed migrations with `pnpm prisma:deploy` and regenerate with
`pnpm prisma:generate` when updating an existing checkout. Existing accounts
enter `/create-character` after signing in. Public cosmetic options live in
`packages/shared/src/character.ts`. See [character implementation notes](docs/CHARACTERS.md)
for contracts, concurrency protection, database constraints and the Phase 3 boundary.
