# Phase 4 — Jobs and first playable build

## Phase 5 integration (current behavior)

SkillsModule now owns durable progression. The historical Phase 4 descriptions
below explain the foundation; their future-skill placeholders are superseded by
[SKILLS.md](SKILLS.md). Jobs now has relational required_skill_id/required_skill_lvl
and XP skill/reward configuration. Cleaner and Shop Assistant stay open; Social 2
unlocks Sales Rep/Photographer, which bridge into Business/Technology careers.
Delivery Rider remains vehicle-locked. No Reputation or vehicle progression exists.
Salary multipliers remain neutral. Start snapshots XP terms; completion atomically
awards skill XP and levels through SkillsService alongside salary/Energy/receipts.
Assignments retain traceable XP results; old Phase 4 shifts keep original no-XP terms.
Job responses expose server-evaluated requirements, XP feedback and genuine unlocks.

## Ownership and scope

JobsModule owns catalog eligibility, shift assignments and timing. CharacterStatsService
owns energy consumption; EconomyService alone appends salary ledger entries and
materializes balances. The modular monolith and approved world-first UI remain intact.
No Skills, XP, underground hustles, Heat/reputation progression, rest system, travel,
background salary worker, game clock or Phaser implementation is introduced.

## Catalog source and balancing

`apps/api/prisma/seed-jobs.sql` is the only initial catalog definition. Run
`pnpm jobs:seed` after migrations. Stable UUIDs/codes and ON CONFLICT DO NOTHING make
reruns safe without overwriting operator tuning. PostgreSQL is authoritative;
frontend components contain no compensation/energy definitions.

Initial per-shift rewards follow the explicit Phase 4 request: Cleaner 8,000;
Shop Assistant 10,000; Delivery Rider 15,000; Sales Rep 20,000; Photographer 35,000;
Designer 45,000; Junior Developer 60,000; Accountant 65,000; Software Engineer 120,000;
Manager 180,000; Consultant 300,000 HK₦. Cleaner (10 Energy / 30 seconds) and Shop
Assistant (12 / 45 seconds) have no progression gate. Other jobs carry explanatory
future requirements and cannot be started. Disabled jobs are omitted from discovery
and rejected by the start endpoint. Reputation requirements use existing stats.

The approved future skill FK/levels are deliberately deferred until the Skills
catalog exists. A bounded `future_requirement` content field provides the actual
Phase 4 lock; Phase 5 will replace this hook with evaluated relational requirements.
No synthetic skill levels or nonexistent skill ownership are created.

## Lifecycle and time

A job assignment is one work shift, not permanent employment. Exactly one ACTIVE
assignment is allowed per character, protected by a partial unique index. Starting
checks identity, enabled content, requirements, active work and energy. It does not
pay money or deduct energy. It records server-generated started_at/completes_at and
snapshots base_reward/energy_cost so later catalog edits cannot change promised terms.

The catalog's cooldown_seconds is the minimum work window for this slice:
completes_at = started_at + cooldown_seconds. There is no additional post-shift wait.
After completion a new eligible shift may start immediately. Completion requires
ACTIVE state and current server time >= completes_at. CANCELLED/EXPIRED statuses
are reserved by the approved schema; no cancellation/expiration endpoints or workers
are built. Reloads restore active work and authoritative timing.

JOBS_DEV_DURATION_SECONDS (1–60) overrides durations only outside production.
Production configuration rejects it. Browser timers never grant eligibility.

## Pay and character resource

Pure functions in packages/game-rules evaluate availability, timing, pay and energy.
Phase 4 salary equals the snapshotted base reward, with neutral skill/performance
multipliers. Phase 5 can extend this calculation without changing ownership of money.
All monetary arithmetic uses bigint; JSON uses decimal strings.

Salary goes entirely to BANK, a deliberate legitimate-income account choice where
the source specifications do not mandate another destination. No arbitrary split
or real-money payout exists. Every salary is JOB_SALARY / CREDIT / BANK with
reference_type=job_assignment and reference_id=the assignment UUID.

Energy is checked at start and completion and deducted only on successful completion.
CharacterStatsService performs a guarded update in the same transaction. Health,
stress, Heat and reputation are unchanged. There are no public stat setters.
Stress change is constrained to zero in this phase's catalog.

## Atomicity, retry and concurrency

The caller owns one Prisma transaction with the existing lock order extended as:
User → owned assignment → wallet. EconomyService's server-only actor-lock seam
rechecks the active account/session after waiting. All work reads/mutations use
that lock, so different API instances and tabs share the same serialization point.
The completion transaction checks the shift, consumes energy, calls
EconomyService.creditJobSalaryInTransaction, marks COMPLETED with its transaction
ID, and creates the durable receipt. Every failure rolls the entire action back.

Existing Phase 3 idempotency_records are reused with jobs.start/jobs.complete
operations, owner-scoped keys and a canonical resource fingerprint. Keys use the
existing 8–128 character syntax. Same key/same intent returns the original result;
changed resource returns IDEMPOTENCY_CONFLICT. Failed actions leave no receipt.
A completed assignment retried with a different key still returns the original
completion and cannot pay or deduct twice. No pending receipt is committed.

SQL protects one active shift, one salary reference per assignment, terminal work
immutability and correspondence between completed assignments and salary ledger
rows. Deferred checks validate amount, ownership, direction, account and reference
in both directions at commit. Existing immutable ledger/balance triggers remain
unchanged. Job terms, payout and completed history cannot be edited to rewrite pay.

## REST and privacy

All routes require the established Bearer guard and return Cache-Control: no-store.
Ownership derives from the principal; no character/wallet selector is accepted.
Bodies and queries must be empty. UUID path IDs and Idempotency-Key are validated.

- GET /api/v1/jobs: safe catalog with evaluated locks and serverNow.
- GET /api/v1/jobs/active: own active assignment or null, plus serverNow.
- POST /api/v1/jobs/:jobId/start: original assignment receipt; 200.
- POST /api/v1/jobs/assignments/:assignmentId/complete: assignment, salary/energy
  result, safe character and precise wallet; 200.
- GET /api/v1/dashboard: Phase 4 character/wallet/work aggregate, last completion,
  hasWorked and serverNow. Future asset/notification/event domains are omitted.

OpenAPI documents only these implemented routes. Stable errors include
JOB_NOT_FOUND, JOB_DISABLED, JOB_REQUIREMENTS_NOT_MET, REPUTATION_REQUIRED,
JOB_ALREADY_ACTIVE, INSUFFICIENT_ENERGY, JOB_NOT_READY, JOB_NOT_ACTIVE,
JOB_ASSIGNMENT_NOT_FOUND and IDEMPOTENCY_CONFLICT. Work mutations have a separate
Redis-backed limit of 60 per account/minute and fail closed on Redis outage.
Existing request IDs link structured operational logs to ledger correlation IDs.
Tokens, request bodies and personal data are not logged.

There is no separate job-history API in the approved Phase 4 contract. Durable
assignments and the latest completion provide work state; paginated wallet history
continues to answer money-history questions without duplicating it.

## Frontend and onboarding

Hustle → Work → Jobs uses route-driven panels over the existing world. Phone also
links to Jobs. Discovery, details, work progress, completion feedback and retry/error
states use one jobs store. Auth remains the owner of current character stats and the
wallet store owns money/history. Historical receipts never overwrite current state:
commands refresh the current dashboard and wallet/history. Sign-out/account-change
epochs and read generations discard stale results; returning focus refreshes work.

Family House offers a concise first-job prompt until the server has a completed
shift. Running shifts offer Resume. The UI countdown is display-only and completion
still requires a backend response. No salary is optimistic or browser-generated.

## Energy recovery limitation and development operation

100 starting Energy supports ten Cleaner shifts. Production recovery is deferred;
this is a limited alpha resource loop, not a complete long-term life simulation.
For local/test fixtures, `pnpm jobs:reset-energy YOUR_LOCAL_CHARACTER_UUID` restores
Energy only. The operator CLI rejects production, exposes no player endpoint, takes
the same User lock and never changes money/history. Do not use it during the defining
first-playable verification journey. Production players have no reset/instant-work
cheat API. Full rest/recovery requires its own approved implementation scope.

## Migration, seed and regression verification

The additive jobs migration creates jobs/job_assignments, JOB_SALARY and SQL guards.
It does not reset, recreate or fund existing players. Apply with pnpm prisma:deploy,
generate the client, then seed. The chain must pass on both the existing development
database and a clean disposable database. Retain funded fixtures and economic work
history; integration job fixtures are disabled after testing rather than deleted.

Unit tests cover pure rules, production configuration gates and browser-state retry
protection. Real database/API tests cover ownership, field injection, time, eligibility,
starts, exact pay, snapshots, 20 simultaneous same/distinct-key completions, energy
bounds, failed payment and failure after ledger writes. Existing auth, character,
wallet and health suites remain regression gates. Mobile/desktop Playwright executes
register → create Yuddy → work → energy loss → pay → Bank history → reload.
