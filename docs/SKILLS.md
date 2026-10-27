# Phase 5 — Skills and player progression

## Domain and persistence

SkillsModule owns the six definitions, character skill rows, XP, levels and queries.
The stable codes are BUSINESS, TECHNOLOGY, TRADING, SOCIAL, FITNESS and STREET.
`character_skills` follows DATABASE.md: composite character/skill primary key,
BIGINT cumulative XP, persisted level, updated timestamp. Initial state is level 1,
0 XP. No public XP, level or training mutation exists.

SkillsService initializes new characters in their creation transaction. Existing
characters use `pnpm skills:backfill`, with bounded batches and the shared User lock.
Missing rows are inserted with skip-duplicates; existing XP is never reset. Queries
also safely initialize missing rows. Migration and backfill do not alter wallets,
Energy, authentication or historical jobs. Old Phase 4 shifts keep their original
terms and award no retroactive XP. No detailed XP event ledger is introduced:
each completed assignment durably records its skill, snapshotted reward, actual
award, previous/current levels and immutable completion receipt.

## V1 balance configuration

`packages/game-rules/src/skills.ts` owns the progression configuration and pure
calculations. Level L begins at `30 × (L−1) × L / 2` cumulative XP. Thresholds are
0, 30, 90, 180, 300, 450, 630, 840, 1080 and 1350. Maximum level is 10. XP stops
at 1350; cap-crossing awards report only the amount actually added. Integer XP
uses bigint and decimal strings at JSON boundaries. Multiple-level crossings work.
Changing the curve/cap requires reviewed data migration and matching SQL constraints;
it is not an environment-secret setting or a live arbitrary formula.

`seed-skills.sql` defines stable skill IDs/codes; reruns preserve tuning.
`configure-job-skills.sql` is the initial job progression configuration, applied
to jobs whose XP configuration is absent. The migration snapshots that initial
configuration for reproducible upgrades; `jobs:seed` also configures fresh catalogs.
`skills:seed` can safely rerun both definition and job configuration scripts.

| Job               | XP skill   | XP per shift | Required skill                  |
| ----------------- | ---------- | -----------: | ------------------------------- |
| Cleaner           | Fitness    |           15 | None                            |
| Shop Assistant    | Social     |           15 | None                            |
| Delivery Rider    | Fitness    |           25 | Fitness 2; still vehicle-locked |
| Sales Rep         | Business   |           25 | Social 2                        |
| Photographer      | Technology |           25 | Social 2                        |
| Designer          | Technology |           25 | Technology 2                    |
| Junior Developer  | Technology |           25 | Technology 3                    |
| Accountant        | Business   |           25 | Business 2                      |
| Software Engineer | Technology |           35 | Technology 5                    |
| Manager           | Business   |           35 | Business 4                      |
| Consultant        | Business   |           40 | Business 6                      |

Sales customer work builds commercial capability; photography provides a bridge
from communication into creative technical tools. These deliberate cross-skill
bridges keep Business and Technology reachable without a training button or circular
requirements. Trading has no active earn source. Phase 6 activates Street through
abstract underground attempts; Street still gates no active jobs.
No vehicle, education, Heat or Reputation progression is added.

Salary remains the Phase 4 base-pay snapshot. Skill and Performance multipliers
remain neutral: Phase 5 improves earning opportunities by unlocking better jobs.
The economy specification permits eventual multipliers but does not mandate them
in this phase. XP is never exchanged for money. Existing pay snapshots are preserved.

## Atomicity, authority and concurrency

Starting work evaluates authoritative skill requirements and snapshots XP skill and
reward alongside pay/Energy/deadline. Completion keeps the existing transaction and
User → assignment → wallet lock order. SkillsService updates XP/level through its
transaction-aware method inside that same boundary. Salary, Energy, ledger,
assignment progression result and idempotency receipt commit together. Failures
after payment or after XP mutation roll all effects back.

Jobs never writes character skill rows; Skills never writes wallets. One assignment
is one logical award, protected by assignment locking, terminal immutability and
the existing durable idempotency model. Same/different-key retries return the
original result. SQL rejects decreasing XP/levels, duplicate states, invalid levels,
inconsistent XP/level combinations and edits to assignment XP terms.

## API and UI

Authenticated `GET /api/v1/skills` returns all six own skill summaries, total XP,
within-level progress, cap state, currently configured work sources and next known
job threshold. `GET /api/v1/skills/catalog` provides the same safe character-scoped
catalog. Unknown query fields are rejected; responses use no-store. No character
selector or mutation API is exposed. OpenAPI describes both endpoints and expanded
job requirement/progression contracts.

Job discovery/detail uses server-computed required/current levels and eligibility.
Completion returns progression and genuine newly met job gates. Unlock means the
skill/progression gate opened; normal Energy/active-work checks still apply.
Me contains a compact six-row roster with XP meters and contextual detail, sources
and next opportunity. Completion announces XP, level-up and unlocked jobs. No audio
or permanent six-skill HUD is added. Reduced motion and accessible text/progress
semantics are preserved. The world remains primary and all artwork remains ALPHA.

Dedicated stores reload current state after work and on opening Me. Identity epochs
discard stale responses; historical completion receipts do not overwrite current
XP or balances. Reloading preserves progression from PostgreSQL.

## Energy boundary

Two Shop Assistant shifts award 30 Social XP, reach level 2 and unlock Sales Rep
and Photographer using 24 of the initial 100 Energy. Starting either better role
is possible with 76 Energy left. This defines the Phase 5 acceptance loop without
manual intervention. Higher thresholds eventually exceed a finite initial Energy
pool. Long-term production progression still requires a separately approved recovery
slice. The existing development-only reset remains an operator/test tool and is
not used in the defining browser progression journey. No Rest, passive recovery,
Fitness recovery bonus or GameClock is introduced.

## Operations and verification

Apply `pnpm prisma:deploy`, regenerate `pnpm prisma:generate`, then run
`pnpm jobs:seed`, `pnpm skills:seed`, `pnpm skills:backfill` before player traffic.
Repeat backfill: zero rows should be created. `pnpm skills:verify` recomputes every
persisted level from authoritative XP and fails on inconsistencies. Run
`pnpm economy:reconcile` after gameplay tests: mismatches must be zero.

Unit tests cover thresholds, cap, invalid input, multiple levels and frontend state.
Integration tests cover initialization/backfill, uniqueness, privacy, real unlocks,
snapshot rewards, injection, ownership, two 20-request completion races and rollback
after XP mutation. Browser tests cover six beginner skills, XP, reload, level-up,
job unlock and starting better work on mobile and desktop. The job-path test checks
reachability from active XP sources without building a generic graph framework.

Phase 6 Hustles call SkillsService inside the same transaction as the immutable
attempt, Energy and Economy ledger changes. Outcome-specific XP is snapshotted;
retries award nothing again. Me includes configured hustle sources and the next
Street opportunity. The same level curve and cap apply. See [Hustles](HUSTLES.md).
Phase 7 Heat/Reputation and later recovery systems are not implemented.
