# Phase 6 — Hustle outcome engine

HustlesModule owns abstract fictional opportunities and immutable outcomes. It calls
CharacterStatsService, SkillsService and EconomyService inside one PostgreSQL
transaction. It never directly edits wallet balances. Redis only rate-limits intent.
There are no operational fraud instructions, victim records or criminal marketplaces.
Heat, Reputation and stress deltas are zero and constrained to remain zero.

## Catalog and progression

`seed-hustles.sql` defines six stable opportunities, rerunnable without overwriting
operator tuning. Amounts below are integer HK naira; additional loss excludes entry.

| Opportunity       | Tier | Street |     Entry |           Reward range | Additional disaster loss | Energy | Cooldown |
| ----------------- | ---: | -----: | --------: | ---------------------: | -----------------------: | -----: | -------: |
| Underground Deal  |    1 |      1 |         0 |          20,000–80,000 |                    2,000 |     15 |      30s |
| Backstreet Chance |    1 |      1 |     1,000 |         30,000–100,000 |                    3,000 |     15 |      45s |
| Cashout Run       |    2 |      2 |    10,000 |        100,000–500,000 |                   15,000 |     20 |      60s |
| City Centre Offer |    3 |      4 |    50,000 |      500,000–3,000,000 |                  100,000 |     20 |     120s |
| Island Contract   |    4 |      6 |   300,000 |   3,000,000–15,000,000 |                  500,000 |     25 |     300s |
| Midnight Deal     |    5 |      8 | 2,000,000 | 15,000,000–100,000,000 |                3,000,000 |     30 |     600s |

Tier 1 weights are BIG_WIN 400, SUCCESS 3600, PARTIAL_SUCCESS 2500, FAILURE 2500,
DISASTER 1000 basis points. Every profile contains exactly these five outcomes,
nonnegative integer weights totaling 10,000 and bounded integer XP. SQL and startup
validate profiles; invalid configuration fails closed. Higher tiers increase risk
and opportunity size. Profiles are server configuration, never public response data.
The generated base-success column derives from the same profile, avoiding drift.

Street changes eligibility only; it does not secretly modify probability. Tier 1
XP is respectively 30/20/12/4/2. Two SUCCESS outcomes grant 40 XP and reach Street 2
using 30 Energy, unlocking Cashout Run's progression gate. Ordinary Bank/Energy and
cooldown checks still apply. All tiers use the existing cap of 1350 XP / level 10.
Trading has no source here. Finite starting Energy remains an alpha limitation;
there is no recovery, Rest or game clock in this phase.

## Immediate atomic lifecycle

Authenticated `POST /api/v1/hustles/:hustleId/attempt` accepts only
`{ "attemptId": "a UUID v4" }` and an `Idempotency-Key` header. The UUID identifies
player intent, not an outcome. There is no separate start/wait/resolve protocol.
An actor transaction locks User, resolves the own character/Street state and locks
the own wallet before eligibility checks and randomness. Reserve must cover entry
plus worst-case additional disaster loss. This prevents both negative Bank and
rejecting an unaffordable disaster to fish for a better outcome.

The server draws one 0–9999 outcome roll with cryptographic rejection sampling.
Positive payout is uniformly selected from inclusive integer bands within the
configured range: partial 0–25% of its span, success 25–80%, big win 80–100%.
Endpoints use integer floor; bands may share boundaries. Failure/disaster pay zero.
Entry is always spent; disaster adds the configured additional loss. All money
uses bigint internally and decimal strings in JSON. No hidden multiplier exists.

Energy, capped Street XP, the immutable attempt/configuration snapshot, Economy
ledger and durable response commit together. Economy appends one BANK HUSTLE_LOSS
for entry plus disaster loss when nonzero, and one BANK HUSTLE_REWARD when nonzero.
Both reference `hustle_attempt` and the UUID. Zero-value ledger rows are omitted.
Deferred SQL triggers validate ledger sums, owner and direction against attempts.
Attempts cannot be edited, deleted or truncated. Corrections require compensations.

The saved deadline imposes one per-character underground cooldown across all
opportunities. There is no durable ACTIVE state. Failed transactions roll back
all effects and expose no chosen outcome. A committed attempt is never rerolled.

## Retries, ownership and errors

Keys are scoped to actor/operation and fingerprint the hustle and intent IDs.
Reusing a key for different intent conflicts. The immutable UUID also deduplicates
the same attempt under different keys; all successful retries return the original
saved result. Twenty concurrent requests are covered by integration tests for both
reward and loss paths. Fresh intents remain distinct and must satisfy cooldown.
An intent owned by another actor returns a safe not-found response.

`GET /api/v1/hustles` returns safe terms, requirements, server time and availability.
`GET /api/v1/hustles/history?limit=20&cursor=...` pages own history (maximum 50).
`GET /api/v1/hustles/attempts/:id` restores an own outcome and original unlocks.
No profile, roll, internal snapshot or other player's private state is serialized.
OpenAPI describes these implemented routes. Mutation rate limits fail closed on
Redis outage. Existing request IDs, origin/auth checks and safe errors apply.

## Operations and verification

Run `pnpm prisma:generate`, `pnpm prisma:deploy`, existing job/skill seeds and
backfill, then `pnpm hustles:seed`. No reset or player-data replacement is needed.
The migration adds two ledger types, five outcomes, catalog and attempt tables,
indexes, profile/snapshot checks and deferred ledger integrity triggers.
Run `pnpm economy:reconcile` and `pnpm skills:verify` after tests; mismatches must be
zero. Seed reruns preserve historical snapshots and existing catalog tuning.

Unit tests exercise probability boundaries, payout/loss math, eligibility and RNG
bounds. Integration tests force every outcome through an injected server provider,
verify ledger/Energy/XP and zero Heat/Reputation changes, retry/concurrency, rollback,
configuration validation, ownership and pagination. Browser tests prepare three
deterministic test-only catalog fixtures, then disable them at teardown. Both
catalog discovery and mutation reject test-only rows outside NODE_ENV=test. The
fixture CLI itself refuses non-test mode. No HTTP debug or forced-outcome switch
exists. Production/development opportunities always use cryptographic randomness.

The browser retains one intent across transport failures and restores saved results
by URL. It reloads current dashboard, wallet/history and Skills after success;
historical receipts never overwrite current balances or XP. Test screenshots cover
mobile/desktop opportunities, detail, confirmation, success, disaster, level-up and
Bank activity. Artwork stays ALPHA. Heat/Reputation, investigations and all Phase 7
gameplay remain unimplemented.
