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

Phase 0 provides the foundation. Phase 1 adds account authentication. Phase 2 adds character identity. Phase 3 adds the authoritative wallet/ledger and game UI foundation.

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
pnpm prisma:deploy
pnpm jobs:seed
pnpm skills:seed
pnpm skills:backfill
pnpm dev
```

Open the web app at <http://127.0.0.1:5173>. The API listens on port 3000.
Home is the Family House world viewport with the player avatar and compact HUD. Phone, Bank and Me open as contextual panels; connection status remains in a small disclosure.
The web app uses only the public `VITE_API_BASE_URL`; server environment variables
are never imported into the frontend. Vite reads the root environment file.
Deployed public API URLs and web origins must use HTTPS. TLS termination belongs
to the deployment environment; Phase 0 does not deploy infrastructure.

### Database workflow

The Prisma schema contains users, sessions, characters/stats, wallets, immutable
ledger entries and durable economic retry receipts. The Phase 2 character migration preserves existing users and sessions. Generated
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
unfunded integration fixtures are removed, while funded integration/browser fixtures retain their immutable accounting history.
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
packages/game-rules    Pure deterministic job eligibility, pay, energy and timing rules
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

Phase 4 adds the first playable work loop. Phase 5 adds durable Skills and job unlocks; underground hustles remain deferred.

### Character creation

Apply committed migrations with `pnpm prisma:deploy` and regenerate with
`pnpm prisma:generate` when updating an existing checkout. Existing accounts
without a character enter `/create-character` after signing in; returning players enter Home. Public cosmetic options live in
`packages/shared/src/character.ts`. See [character implementation notes](docs/CHARACTERS.md)
for contracts, concurrency protection, database constraints and the Phase 3 boundary.

### Economy initialization and verification

After applying migrations and generating Prisma, initialize existing Phase 2
characters before reopening player traffic:

```sh
pnpm economy:backfill
pnpm economy:reconcile
```

Backfill is rerunnable and funds each character exactly once. New character creation
funds the wallet atomically. Reconciliation reports counts/mismatches without private
player data and never silently repairs balances. Funded test history must not be
removed by disabling protections. No public credit/debit or real-money payout exists.

See [economy implementation](docs/ECONOMY-IMPLEMENTATION.md) and
[world-first UI guide](docs/UI-UX.md). Phase 3.1 establishes the Family House world,
compact HUD and route-driven panels. `/phone` opens the device launcher; its Bank app
(`/wallet`) provides fictional cash/bank moves and paginated history. `/account` opens
Me; `/city` remains a locked preview. `/hustle` opens the work hub and `/jobs`
opens the noticeboard, detail and active-shift panels. Home stays within the viewport.
Travel, production rest recovery and Phaser gameplay remain deferred.

### Jobs — first playable build

After migrations, run `pnpm jobs:seed`. Its single SQL catalog is rerunnable and
preserves existing catalog tuning. Cleaner and Shop Assistant are immediately
available; higher roles explain their future progression requirements. Salary is
paid into Bank through EconomyModule, atomically with energy and assignment state.
See [Jobs implementation](docs/JOBS.md) for the contracts and invariants.

Cleaner shifts take 30 seconds and cost 10 Energy. Shop Assistant shifts take 45
seconds and cost 12. For local testing only, set `JOBS_DEV_DURATION_SECONDS=2`
(1–60); production rejects this override. Playwright supplies its own short test timing.
The browser cannot shorten a shift or choose its reward.

Recovery remains a documented alpha limitation: 100 Energy supports ten Cleaner
shifts. For development/test fixtures only, restore energy using:

```sh
pnpm jobs:reset-energy YOUR_LOCAL_CHARACTER_UUID
```

This operator CLI is rejected in production, exposes no player endpoint, and
changes no money. Do not use it during the first-playable verification journey.
Existing players need no new character or starting-wallet initialization.

### Skills and progression

Apply the additive migration, regenerate Prisma, seed jobs/skills and run
`pnpm skills:backfill` before reopening player traffic. Existing characters are
preserved. Repeating backfill creates no duplicate states or resets. New characters
receive all six skills automatically. `pnpm skills:verify` checks XP/level consistency.

Me shows six skills, XP and next opportunities. Two Shop Assistant shifts reach
Social Level 2 and unlock Sales Rep and Photographer within starting Energy.
Salary, Energy, XP and level changes commit atomically; retries award once.
Salary multipliers remain neutral. Long-term Energy recovery remains deferred.
See [Skills implementation](docs/SKILLS.md) for mappings, thresholds and operations.
