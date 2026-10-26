# HUSTLING KINGDOM — ARCHITECTURE.md

**Version:** 1.0  
**Architecture:** Modular Monolith  
**Primary language:** TypeScript  
**Client:** Vue 3 + Phaser  
**Server:** NestJS  
**Database:** PostgreSQL/Prisma  
**Cache/Queue:** Redis/BullMQ  
**Realtime:** Socket.IO

## Goals

Optimize V1 for fast development, economic correctness, security, observability, simple deployment and a path from hundreds to 100k+ active players without premature distributed-system complexity.

## Core Principle: Server Owns Reality

The client is never authoritative for money, prices, rewards, inventory, properties, vehicles, businesses, skills, reputation, Heat, health, energy, trading outcomes or hustle outcomes. Vue/Phaser requests actions; NestJS validates rules, calculates outcomes and commits state atomically.

## System Overview

Cloudflare sits in front of the Vue web client and NestJS API/WebSocket layer. PostgreSQL stores durable truth. Redis provides cache, presence, rate-limit counters and BullMQ backing. Object storage holds game assets, avatars, ad creatives and generated share cards.

## Monorepo

Use pnpm workspaces:

```text
hustling-kingdom/
├── apps/web
├── apps/api
├── packages/shared
├── packages/game-rules
├── packages/validation
├── packages/config
├── docs
├── infrastructure
├── AGENTS.md
├── docker-compose.yml
└── README.md
```

## Frontend

Vue 3 + TypeScript + Vite + Pinia + Vue Router + Tailwind handle authentication, navigation, dashboard, phone UI, jobs, hustles, businesses, properties, vehicles, trading, profiles, leaderboards, settings and admin interfaces.

Phaser handles the city map, characters, buildings, movement, location interaction, world objects, animations and player presence. Use a GameBridge boundary so Phaser does not unpredictably mutate application state.

Organize the Vue application by feature: auth, character, wallet, jobs, hustles, trading, properties, vehicles, businesses, relationships, nightlife, profile, leaderboards and notifications.

## Backend Modules

NestJS remains one deployable app with modules for auth, users, characters, economy, jobs, hustles, skills, Heat, reputation, trading, properties, vehicles, businesses, relationships, nightlife, inventory, locations, events, social, leaderboards, achievements, notifications, advertising, analytics and admin.

Modules call domain services rather than mutating another module's tables directly. In particular, only EconomyService may mutate wallet balances.

## Economy Service

Owns wallets, balances, ledger, credits, debits, idempotency and economic transaction orchestration. Vehicle/business/hustle/job modules request economic operations through this boundary.

## Atomic Transactions and Idempotency

Purchases and rewards execute inside database transactions. Sensitive mutation endpoints accept an `Idempotency-Key`; repeated valid requests return the original result. Concurrent spends use database-level protection rather than application-memory locks.

## Authentication and Authorization

V1 uses email/username/password, short-lived access tokens and rotating server-revocable hashed refresh tokens. Roles: PLAYER, MODERATOR, ADMIN, SUPER_ADMIN. Authorization is enforced server-side.

## Character and Game Rules

Keep User identity separate from Character game identity. Put deterministic calculations in `packages/game-rules` as pure/testable functions where possible: rewards, Heat, business revenue, net worth, depreciation and recovery. Wrap randomness behind a server-side RandomService for deterministic tests.

## Redis and BullMQ

Redis caches leaderboards/public profiles/config, holds ephemeral presence and rate-limit state, and backs BullMQ. PostgreSQL remains authoritative. Background jobs handle business payouts, rent, Heat decay, snapshots, notifications, leaderboard refresh, world events and analytics aggregation. Jobs must be idempotent.

## Game Clock and Events

A GameClockService owns real-to-game time conversion, cooldowns, payout/rent periods and schedules. Separate technical domain events (JobCompleted, VehiclePurchased) from gameplay world events (FuelScarcity, PropertyBoom). World events modify defined configuration parameters rather than executing arbitrary stored code.

## Trading

Trading is a fictional server-controlled market engine. Prices and history are authoritative on the server; clients receive updates by Socket.IO or polling. It is not connected to real brokerage execution.

## Realtime

Socket.IO is used for player presence, map movement, location occupancy, market updates and important notifications. Transactional actions such as purchases remain REST mutations. High-frequency pixel movement is ephemeral and not written continuously to PostgreSQL.

## Location, Inventory and Configuration

Locations are server-defined with type, district, coordinates and requirements. Inventory uses catalog + ownership tables rather than giant JSON blobs. Game-balance configuration is separate from environment secrets and supports versioned development/staging/production values.

## Admin and Advertising

Protected admin routes manage players, jobs, hustles, properties, vehicles, businesses, events, advertising and economy configuration. Advertising uses advertiser → campaign → creative → placement → impression/click models. Real illicit-service advertising is prohibited.

## Analytics and Observability

Gameplay emits domain/analytics events asynchronously. Production uses structured logs, request/correlation IDs, error tracking, performance/queue/database/economy metrics. Sensitive transactions must be traceable.

## API

Version endpoints under `/api/v1`. Standardize error responses around stable error codes such as `INSUFFICIENT_FUNDS` plus a request ID. Validate both request syntax and domain permission/eligibility.

## Security and Cheat Resistance

Assume players inspect JavaScript, network traffic, WebSocket messages, local storage and Pinia state. Secrets and hidden probability tables stay server-side. Browser state changes never create server-side wealth. Rate-limit authentication and sensitive gameplay endpoints.

## PostgreSQL and Prisma

Use PostgreSQL relational constraints aggressively. Prisma is the data-access tool, not the architecture. Controllers call application/domain services rather than directly implementing complex Prisma workflows. Every schema change uses reviewed migrations.

## Testing

Unit-test game rules; integration-test wallet/ledger and domain workflows; API-test validation/auth; Playwright-test core player journeys. Add economic invariant tests for ledger consistency, duplicate idempotency keys, concurrent spending and duplicate payouts.

## Development and CI/CD

Docker Compose supplies PostgreSQL and Redis locally while Vue/NestJS can run with hot reload. Maintain development, staging and production environments. Every PR runs install, lint, typecheck, unit/integration tests and build. Production deploys only after checks pass.

## Deployment and Scaling

Start without Kubernetes: Cloudflare, static web hosting/CDN, NestJS containers, managed PostgreSQL/Redis where reasonable and object storage. Scale horizontally by adding API instances/workers, caching and realtime scaling. Extract specialized services only when traffic evidence justifies it.

## Failure Philosophy

Secondary failures must not corrupt core gameplay. If a car purchase commits but analytics/notification fails, the player still owns the car; asynchronous systems retry separately. Consider a transactional outbox for reliable post-commit domain events.

## Audit, Moderation and Feature Flags

Administrative actions are append-only audited. Moderators can warn, rename inappropriate public identifiers, suspend, ban or mute social features. Feature flags gate trading, nightlife, relationships, map and advertising for safe rollouts.

## Build Order

First slice: register → login → character → HK₦20k wallet → starter job → salary → ledger → dashboard. Second: abstract hustles → outcome → reward/Heat/reputation/cooldown. Third: vehicle purchase → debit → ownership → reputation. Fourth: business startup → periodic revenue/expense → ledger.

## Codex Rule

Codex must read `AGENTS.md` and relevant `/docs` files, then implement only the named roadmap slice. It must not implement the entire architecture at once or silently change architectural decisions.

## Definition of Done

A feature requires domain rules, migration, API, validation, authorization, frontend, loading/error states, tests, lint/typecheck success and documentation updates. Economy features additionally require verified ledger behavior, atomicity, idempotency and concurrency handling.

## Architecture Decision Records

Maintain `docs/adr/` for major decisions such as modular monolith, server-authoritative economy, PostgreSQL source of truth and Vue/Phaser boundary.
