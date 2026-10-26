# HUSTLING KINGDOM — ROADMAP.md

**Version:** 1.0  
**Status:** V1 Implementation Roadmap  
**Execution Model:** Small vertical slices, one phase at a time  
**Primary Coding Agent:** Codex

## 1. Roadmap Rule

Codex must implement only the explicitly assigned phase. It must read `AGENTS.md` and relevant `/docs` first, inspect the existing repository, state the implementation approach, implement the smallest complete slice, add tests, run required checks, and report changes.

Do not pre-build later phases “for convenience”.

Every phase must leave the repository buildable and testable.

---

## 2. Milestones

```text
M0  Engineering foundation
M1  Account + character
M2  First playable economy
M3  Core Hustling Kingdom loop
M4  Ownership economy
M5  Life simulation
M6  Social/world layer
M7  Commercial/admin layer
M8  Production-ready closed alpha
```

The two critical early checkpoints are:

```text
PHASE 4  → FIRST PLAYABLE BUILD
PHASE 7  → CORE GAME LOOP
```

---

# PHASE 0 — Repository Foundation

## Goal

Create the monorepo and development infrastructure without implementing gameplay.

## Deliverables

```text
apps/web
apps/api
packages/shared
packages/game-rules
packages/validation
packages/config
docs
infrastructure
```

Configure:
- pnpm workspaces;
- Vue 3 + TypeScript + Vite;
- Pinia;
- Vue Router;
- Tailwind CSS;
- NestJS + TypeScript;
- Prisma;
- PostgreSQL;
- Redis;
- BullMQ;
- Socket.IO packages;
- Vitest;
- Playwright;
- ESLint;
- Prettier;
- Docker Compose for PostgreSQL and Redis;
- environment validation;
- CI workflow.

## Backend

Implement:
- NestJS bootstrap;
- global validation;
- standard error envelope;
- request/correlation ID;
- `/health/live`;
- `/health/ready`;
- API `/api/v1` prefix;
- OpenAPI foundation.

## Frontend

Implement:
- app shell;
- router;
- base layouts;
- typed API client foundation;
- global error handling;
- environment configuration.

## Tests

Verify:
- web builds;
- API builds;
- health endpoint;
- database connection;
- Redis connection;
- lint;
- typecheck;
- unit test command;
- Playwright boot smoke test.

## Do Not Implement

Authentication, characters, wallet, jobs, game map, hustles, businesses or other gameplay.

## Exit Criteria

Fresh clone can be started using documented commands and all CI checks pass.

---

# PHASE 1 — Authentication

## Goal

A player can create and securely access an account.

## Database

Implement:
- `users`;
- refresh/session records;
- required enums/indexes.

## API

Implement:
- `POST /auth/register`;
- `POST /auth/login`;
- `POST /auth/refresh`;
- `POST /auth/logout`;
- `POST /auth/logout-all`;
- `GET /me`.

Requirements:
- password hashing;
- unique normalized email/username;
- rotating refresh sessions;
- rate limiting;
- standardized errors;
- authorization guards.

## Web

Implement:
- register page;
- login page;
- authenticated route guard;
- session restoration;
- logout.

## Tests

Cover:
- registration;
- duplicate email/username;
- correct/incorrect login;
- refresh rotation;
- revoked refresh rejection;
- protected endpoint;
- logout.

## Do Not Implement

Character creation or economy.

## Exit Criteria

A user can register, log in, refresh a session, access `/me`, log out and cannot access protected routes after revocation.

---

# PHASE 2 — Character Creation

## Goal

An authenticated user creates the one V1 playable character.

## Database

Implement character and character-stat tables required by `DATABASE.md`.

## API

Implement:
- `POST /characters`;
- `GET /characters/me`;
- allowed appearance update endpoint.

Character creation is idempotent.

Do not yet award starting currency unless the wallet transaction can be implemented atomically. If wallet infrastructure is introduced here, it must follow Phase 3 invariants; otherwise defer economic initialization to the Phase 3 migration/service.

## Web

Implement:
- character creation wizard;
- appearance selection;
- character summary.

Target completion time: under 60 seconds.

## Tests

Cover:
- authenticated creation;
- duplicate character rejection/idempotent retry;
- invalid appearance;
- ownership isolation.

## Exit Criteria

Each V1 account can have exactly one valid primary character.

---

# PHASE 3 — Wallet + Immutable Ledger

## Goal

Create the authoritative economic foundation.

## Database

Implement:
- wallets/accounts;
- ledger transactions;
- idempotency records;
- relevant constraints/indexes.

## Backend

Create `EconomyModule`.

Only this domain may perform wallet balance mutation.

Implement:
- `credit`;
- `debit`;
- internal cash/bank movement;
- balance read;
- ledger read;
- reconciliation helpers.

Character initialization must result in:

```text
Cash: HK₦15,000
Bank: HK₦5,000
Total: HK₦20,000
```

with corresponding immutable ledger history.

Existing Phase 2 characters must be migrated/initialized safely and exactly once.

## API

Implement:
- `GET /wallet`;
- `GET /wallet/transactions`;
- `POST /wallet/deposit`;
- `POST /wallet/withdraw`.

## Tests

Mandatory invariant tests:
- every balance mutation has ledger history;
- duplicate idempotency key cannot duplicate money;
- concurrent spending cannot overspend;
- failed transaction rolls back;
- starting balance occurs exactly once;
- account totals reconcile with ledger.

## Exit Criteria

Economy invariants pass under normal, retry and concurrency scenarios.

---

# PHASE 4 — Jobs + First Playable Build

## Goal

Complete the first money-earning gameplay loop.

## Database

Implement:
- job catalog;
- job requirements;
- job assignments;
- required skill hooks without building the full skill system.

Seed starter jobs.

## API

Implement:
- `GET /jobs`;
- `POST /jobs/:id/start`;
- `GET /jobs/active`;
- `POST /jobs/assignments/:id/complete`;
- `GET /dashboard`.

Completion:
- validates assignment/cooldown;
- calculates reward server-side;
- credits through EconomyModule;
- records ledger;
- updates energy/stress as defined;
- commits atomically.

## Web

Implement:
- dashboard;
- wallet summary;
- job list;
- start-job flow;
- active-job state;
- complete-job flow;
- transaction history.

## Required User Journey

```text
REGISTER
→ LOGIN
→ CREATE CHARACTER
→ RECEIVE HK₦20K
→ VIEW DASHBOARD
→ CHOOSE STARTER JOB
→ COMPLETE JOB
→ RECEIVE SALARY
→ VIEW LEDGER
```

## Tests

Include full API integration test and Playwright journey.

## Exit Criteria — FIRST PLAYABLE BUILD

A new player can complete the entire journey without database/manual intervention.

---

# PHASE 5 — Skills

## Goal

Introduce persistent capability progression.

Implement V1 skills:
- Business;
- Technology;
- Trading;
- Social;
- Fitness;
- Street.

## Backend

Implement pure game-rule calculations for XP/levels and job requirement evaluation.

No public XP setter.

## Web

Add skills screen and job unlock feedback.

## Tests

Level boundaries, XP awards, requirements and duplicate-award protection.

## Exit Criteria

Gameplay can unlock higher jobs through server-authoritative skill progression.

---

# PHASE 6 — Hustle Outcome Engine

## Goal

Implement abstract risk/reward gameplay.

## Database

Implement:
- hustle definitions;
- requirements;
- attempts;
- outcome metadata.

## Backend

Implement:
- `RandomService`;
- deterministic/testable outcome calculation;
- server-side reward;
- energy/stress effects;
- cooldown;
- economic credit/loss.

Keep crime mechanics fictional and abstract.

## API

- `GET /hustles`;
- `POST /hustles/:id/attempt`.

## Web

Hustle discovery, risk/reward display, attempt/result experience.

## Tests

Success/failure branches using controlled RNG, retries, cooldowns, insufficient requirements, atomic reward/loss.

## Exit Criteria

Players can choose between predictable jobs and higher-variance fictional hustles.

---

# PHASE 7 — Heat + Reputation

## Goal

Complete the core risk/status loop.

## Backend

Implement:
- Heat events/history;
- reputation events/history;
- Heat status bands;
- Heat decay worker;
- hustle integration;
- reputation tier calculations.

No real-world evasion mechanics.

## API

- `GET /heat`;
- `GET /heat/history`;
- `GET /reputation`.

## Web

Display:
- Heat meter/status;
- reputation score/tier;
- activity effects;
- dashboard warnings.

## Tests

Heat/reputation mutations, decay idempotency, thresholds, history, atomic hustle integration.

## Exit Criteria — CORE GAME LOOP

```text
WORK SAFELY
      ↘
       EARN → SPEND/SAVE
      ↗
RISKY HUSTLE
      ↓
MONEY + REPUTATION + HEAT
      ↓
PLAYER CHOOSES WHAT TO DO NEXT
```

At this point the product should be playtested before expanding scope.

---

# PHASE 8 — Vehicles

Implement vehicle catalog, ownership, purchase, resale, maintenance, reputation effects and profile display.

All prices server-side. Purchase/sale atomic and idempotent.

Exit: player can earn, buy a vehicle, lose money, gain reputation and see ownership publicly where permitted.

---

# PHASE 9 — Properties

Implement property catalog, purchase/rent, ownership/tenancy, recurring rent, selected appreciation rules and residence effects.

Rent worker must be idempotent.

Exit: housing becomes both progression and recurring economic pressure.

---

# PHASE 10 — Businesses

Implement business types, creation, ownership, upgrades, revenue/expense cycles, valuation and business skill modifiers.

Payout workers must have cycle-level uniqueness so the same period cannot pay twice.

Exit: players can convert active income into productive assets.

---

# PHASE 11 — Fictional Trading

Implement fictional market instruments, generated market state/history, positions, settlement and risk levels.

No real brokerage integration and no real-money investment execution.

Exit: players can risk virtual capital through a controlled server-side simulation.

---

# PHASE 12 — Inventory

Implement item catalog, ownership, quantity/equipped state and purchases.

Avoid giant JSON inventory blobs.

Exit: assets/cosmetics can be owned and equipped consistently.

---

# PHASE 13 — Relationships

Implement NPC relationship definitions, trust/compatibility/loyalty state and abstract choices/events.

Relationships cannot be reduced to “pay money = affection”.

Exit: relationship decisions affect life/economy without becoming a purchasing mechanic.

---

# PHASE 14 — Nightlife

Implement venues, events, entry/table spending and reputation effects.

Nightlife is a major money sink.

Exit: players can visibly trade wealth for social status.

---

# PHASE 15 — World Events + Game Clock

Formalize `GameClockService`.

Implement scheduled world events and configurable economic modifiers.

Examples include fictional festive periods, property booms, recessions and transport-cost changes.

Exit: global events can change game conditions without code rewrites.

---

# PHASE 16 — Fictional Case / Consequence System

Implement Heat-triggered abstract case events, legal expenses, asset effects and playable consequence states.

Use fictional enforcement organizations.

Do not model real investigative methods or evasion.

Exit: high Heat can create meaningful financial/gameplay consequences.

---

# PHASE 17 — Achievements + Public Profiles

Implement achievements and deliberately public profile views.

Private fields remain private.

Exit: players have visible identity/status worth sharing.

---

# PHASE 18 — Leaderboards

Implement cached/precomputed rankings:
- net worth;
- reputation;
- business empire;
- property;
- trading;
- fastest rising.

Exit: rankings do not require expensive full-database computation per request.

---

# PHASE 19 — Notifications + Share Cards

Implement durable notifications and asynchronous share-card generation.

Share templates include net worth, achievements, major losses, purchases and comeback milestones.

Exit: meaningful game events can be surfaced and safely shared.

---

# PHASE 20 — Phaser City

## Goal

Add the visual world after the underlying game is already fun.

Implement:
- Phaser bootstrap inside Vue;
- `GameBridge`;
- one fictional city/district slice;
- buildings;
- player avatar;
- basic movement;
- location interaction;
- billboard placeholders.

Do not rebuild dashboard/forms in Phaser.

Exit: player can move through a stylized city and enter existing gameplay features.

---

# PHASE 21 — Multiplayer Presence

Implement Socket.IO presence:
- location join/leave;
- nearby player visibility;
- validated movement;
- Redis-backed ephemeral presence where needed.

Do not continuously write pixel movement to PostgreSQL.

Exit: multiple players can see each other in supported locations.

---

# PHASE 22 — Advertising

Implement advertisers, campaigns, creatives, placements, impression/click tracking and admin approval.

Only legitimate real-world advertising is supported.

Exit: a controlled campaign can appear in a virtual placement and produce trustworthy basic telemetry.

---

# PHASE 23 — Admin Console

Implement protected administration for:
- players;
- jobs;
- abstract hustles;
- vehicles;
- properties;
- business types;
- world events;
- ads;
- economy configuration;
- feature flags;
- audit logs.

High-risk actions require audit reasons.

Exit: common content/economy operations no longer require code changes.

---

# PHASE 24 — Analytics + Economy Operations

Implement domain-event analytics pipeline and dashboards for:
- registrations;
- character creation;
- retention inputs;
- activity completion;
- currency created/destroyed;
- median/top net worth;
- bankruptcies;
- asset ownership;
- business creation;
- Heat;
- shares;
- advertising.

Exit: the team can identify inflation and actual player behavior.

---

# PHASE 25 — Production Hardening

Perform:
- security review;
- load tests;
- concurrency/economy stress tests;
- backup/restore drill;
- queue failure tests;
- dependency audit;
- rate-limit validation;
- observability checks;
- accessibility pass;
- responsive/mobile pass;
- database/index review;
- feature-flag verification.

Do not optimize from guesswork; profile first.

Exit: documented release checklist passes.

---

# PHASE 26 — Closed Alpha

Release to a small controlled player cohort.

Primary questions:
- Can users understand the game without explanation?
- Do they return?
- Which earning paths are used?
- Are money sinks meaningful?
- Does inflation appear?
- Is Heat understandable?
- Is progression too fast/slow?
- Which features create stories/shares?
- Where do players quit?

Do not respond to every request by immediately expanding scope.

Fix:
- blockers;
- exploits;
- economy imbalance;
- confusing onboarding;
- retention-breaking friction.

Exit: evidence supports moving toward a broader beta.

---

# 27. Git Strategy

Use small feature branches/PRs.

Example:

```text
feat/phase-03-wallet-ledger
feat/phase-04-jobs
fix/economy-idempotency
```

Do not mix unrelated phases into one change set.

---

# 28. Phase Completion Report

Codex must finish an assigned phase with:

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

No claim of completion if lint/typecheck/tests fail.

---

# 29. Mandatory Quality Gate

At each applicable phase run:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run integration/E2E suites when the phase touches those surfaces.

CI is authoritative.

---

# 30. Economic Feature Gate

Any feature that changes currency must demonstrate:

- authoritative server calculation;
- immutable ledger entry;
- atomic commit;
- idempotency where applicable;
- concurrency safety;
- rollback behavior;
- reconciliation test.

If these are missing, the feature is not complete.

---

# 31. Scope Discipline

Codex must not introduce:
- microservices;
- Kubernetes;
- crypto/NFTs;
- real-money withdrawal;
- real-money gambling;
- real criminal marketplaces;
- operational fraud mechanics;
- AI NPCs;
- voice chat;
- open-world driving;
- native apps;
- complex clans/gangs

unless a later approved specification explicitly changes V1 scope.

---

# 32. Recommended First Codex Execution Sequence

```text
RUN 1 → Phase 0 only
REVIEW
COMMIT

RUN 2 → Phase 1 only
REVIEW
COMMIT

RUN 3 → Phase 2 only
REVIEW
COMMIT

RUN 4 → Phase 3 only
DEEP ECONOMY REVIEW
COMMIT

RUN 5 → Phase 4 only
PLAY FIRST BUILD
```

Do not queue all phases into one Codex request.

---

# 33. Product Validation Gate

After Phase 7, stop major feature expansion temporarily.

Give the core loop to real testers.

If:

```text
job → money → hustle → risk → reputation → Heat → decision
```

is not fun, adding clubs, cars and a prettier city will not solve the underlying product.

Tune the loop first.

---

# 34. Final Roadmap Principle

```text
SPECIFY
  ↓
BUILD SMALL
  ↓
TEST
  ↓
PLAY
  ↓
MEASURE
  ↓
ADJUST
  ↓
CONTINUE
```

The objective is not to make Codex write the most code.

The objective is to make each Codex run move Hustling Kingdom toward a reliable, playable product.
