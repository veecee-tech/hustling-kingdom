# HUSTLING KINGDOM — AGENTS.md

## Project

Hustling Kingdom is a mobile-first multiplayer Nigerian life, hustle and economic simulation game.

Read relevant files under `/docs` before implementing work.

Source-of-truth documents include:

```text
docs/GDD.md
docs/ECONOMY.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API.md
docs/SECURITY.md
docs/ROADMAP.md
```

When documents conflict, do not silently choose. Report the conflict and prefer the more specific approved specification unless instructed otherwise.

## Stack

Frontend:
- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Tailwind CSS
- Phaser for the interactive world

Backend:
- NestJS
- TypeScript
- REST
- Socket.IO

Data/infrastructure:
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Docker

Testing:
- Vitest
- backend integration tests
- Playwright

Package manager:
- pnpm workspaces

## Architecture

Use a modular monolith.

Do not introduce microservices or Kubernetes unless explicitly approved.

The server is authoritative for game state.

The client expresses intent; it does not declare outcomes.

Vue owns application UI. Phaser owns the interactive world. Keep a deliberate bridge between them.

## Economy Rules

The economy is security-critical.

Never trust client-provided:
- balances;
- prices;
- rewards;
- profit/loss;
- reputation changes;
- Heat changes;
- inventory/ownership;
- success outcomes.

All currency mutations must go through the Economy domain.

Never directly mutate a wallet from Jobs, Hustles, Vehicles, Properties, Businesses, Trading, Nightlife or other modules.

Maintain immutable ledger history.

Never mutate a balance without the corresponding ledger transaction.

Corrections use compensating transactions rather than editing history.

Use database transactions for multi-record economic actions.

Use idempotency for retry-sensitive mutations.

Design for concurrent requests and prevent double spend, duplicate payout and duplicate ownership.

Use integer values for game currency. Never use floating-point arithmetic for money.

## Database

PostgreSQL is durable truth.

Redis is for cache, ephemeral presence, rate-limit state and queues—not permanent wallet truth.

Use migrations for schema changes.

Use foreign keys, unique constraints, checks and indexes where they protect domain invariants.

Do not store major relational domains as giant JSON blobs merely for convenience.

## Game Rules

Prefer pure/testable functions in `packages/game-rules` for deterministic calculations.

Wrap randomness behind a server-side abstraction so tests can control outcomes.

Never use browser randomness to decide authoritative gameplay.

## API

Use `/api/v1`.

Use standardized success/error contracts and stable error codes.

Validate external input.

Controllers should be thin:

```text
Controller
→ Application/Domain Service
→ Domain Rules
→ Repository/Economy Service
→ Database
```

Do not place core economic calculations directly in controllers.

## Authentication / Security

Use established libraries for password hashing, authentication and cryptographic needs. Do not invent cryptography.

Do not commit secrets.

Do not expose secrets, internal security state, hidden probability tables, private player data or anti-cheat thresholds to the frontend.

Admin authorization is enforced server-side.

Public profiles expose only deliberately public fields.

## Fictional Crime Safety Boundary

Crime-related gameplay is fictional, satirical and abstract.

Do not implement systems that facilitate real-world:
- phishing;
- credential theft;
- benefit/payment fraud;
- stolen accounts;
- laundering;
- criminal picker networks;
- victim targeting;
- criminal-service discovery;
- law-enforcement evasion.

Do not store real victim data or criminal credentials.

Fictional underground activities may exist only as abstract game actions with server-generated outcomes, risk, Heat and consequences.

Real advertising must be for legitimate services.

## Scope

Implement only the roadmap phase explicitly requested.

Do not pre-build future phases.

Do not introduce unrelated dependencies or architecture changes.

Do not refactor unrelated working code unless necessary for the assigned phase and clearly explain why.

V1 excludes:
- native mobile apps;
- crypto/NFTs;
- real-money withdrawals;
- real-money gambling;
- AI NPCs;
- voice chat;
- complex combat;
- open-world driving;
- player-created maps;
- complex clans/gangs;
- real criminal marketplaces.

## Workflow

For every task:

1. Read this file.
2. Read the relevant `/docs` specifications.
3. Inspect the existing implementation before editing.
4. Identify the requested roadmap phase/slice.
5. State a concise implementation approach.
6. Identify affected modules/files.
7. Implement the smallest complete vertical slice.
8. Add/update migrations where required.
9. Add tests.
10. Run lint.
11. Run typecheck.
12. Run relevant unit/integration/E2E tests.
13. Run build.
14. Fix failures caused by the change.
15. Report exactly what changed and what remains intentionally unimplemented.

If a major architectural decision is required and the docs do not resolve it, stop and propose the decision rather than silently inventing architecture.

## Definition of Done

A feature is complete only when applicable:
- domain rules are implemented;
- schema/migration is correct;
- API is implemented;
- validation is implemented;
- authorization is implemented;
- frontend states are implemented;
- loading/error states exist;
- tests exist;
- lint passes;
- typecheck passes;
- tests pass;
- build passes;
- documentation is updated.

For economic features also verify:
- ledger correctness;
- atomicity;
- idempotency;
- concurrency;
- rollback;
- reconciliation.

## Completion Report

End implementation work with:

```text
SUMMARY
FILES CHANGED
MIGRATIONS
API CHANGES
TESTS ADDED
COMMANDS RUN
RESULTS
KNOWN LIMITATIONS
NEXT PHASE NOT IMPLEMENTED
```

Do not claim success when required checks fail.

## Core Principle

**The player requests actions. The server determines reality.**
