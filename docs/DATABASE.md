# HUSTLING KINGDOM — DATABASE.md

**Version:** 1.0  
**Status:** V1 Database Design Specification  
**Database:** PostgreSQL  
**ORM:** Prisma  
**Architecture:** Modular Monolith

## 1. Database Principles

PostgreSQL is the durable source of truth for Hustling Kingdom. Redis may cache or hold ephemeral state, but permanent player, economic, ownership, progression, and audit data belongs in PostgreSQL.

Core rules:

- Use UUIDs for externally visible primary identifiers.
- Store monetary values as integers in the smallest game-currency unit; never use floating point for balances.
- Every wallet mutation must have a corresponding immutable ledger transaction.
- Economic mutations must be atomic.
- Sensitive mutations must support idempotency.
- Use foreign keys, unique constraints, checks, and indexes to protect invariants.
- Prefer normalized relational data over large mutable JSON blobs.
- JSONB is allowed for flexible metadata, not as a substitute for core schema design.
- Use `created_at` and `updated_at` consistently; immutable records omit meaningful updates where appropriate.
- Soft deletion is used only where historical identity must remain visible; economic history is never deleted.

## 2. High-Level Domain Model

```text
User
 └── Character
      ├── Wallet
      │    └── Transactions
      ├── CharacterStats
      ├── CharacterSkills
      ├── JobAssignments
      ├── HustleAttempts
      ├── Inventory
      ├── Properties
      ├── Vehicles
      ├── Businesses
      ├── Relationships
      ├── Achievements
      ├── Notifications
      └── EconomySnapshots

Game Content
 ├── Jobs
 ├── Hustles
 ├── Skills
 ├── Items
 ├── Properties
 ├── Vehicles
 ├── BusinessTypes
 ├── Locations
 ├── Achievements
 └── WorldEvents
```

## 3. Naming Conventions

Database tables use `snake_case`. Prisma models may use PascalCase with explicit table mappings where useful.

Examples:

```text
users
characters
wallets
wallet_transactions
character_skills
job_assignments
hustle_attempts
player_properties
player_vehicles
player_businesses
```

Use explicit names for constraints and indexes where operationally useful.

## 4. users

Represents authentication/account identity, not the in-game persona.

```text
users

id                  uuid PK
email               varchar UNIQUE NOT NULL
username            varchar UNIQUE NOT NULL
password_hash       varchar NOT NULL
role                enum NOT NULL DEFAULT PLAYER
status              enum NOT NULL DEFAULT ACTIVE
email_verified_at   timestamptz NULL
last_login_at       timestamptz NULL
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Suggested roles:

```text
PLAYER
MODERATOR
ADMIN
SUPER_ADMIN
```

Suggested statuses:

```text
ACTIVE
SUSPENDED
BANNED
DEACTIVATED
```

Indexes:

- unique lower-cased email strategy
- unique lower-cased username strategy
- status when moderation queries justify it

## 5. auth_sessions / refresh_tokens

Refresh credentials must be revocable and stored hashed.

```text
auth_sessions

id                  uuid PK
user_id             uuid FK -> users.id
refresh_token_hash  varchar NOT NULL
expires_at          timestamptz NOT NULL
revoked_at          timestamptz NULL
user_agent          varchar NULL
ip_hash             varchar NULL
created_at          timestamptz NOT NULL
```

Never store raw refresh tokens.

## 6. characters

V1 supports one primary character per user while keeping the model extensible.

```text
characters

id                  uuid PK
user_id             uuid FK -> users.id
name                varchar NOT NULL
slug                varchar UNIQUE NOT NULL
gender              enum NOT NULL
appearance           jsonb NOT NULL
current_location_id  uuid NULL FK -> locations.id
status               enum NOT NULL DEFAULT ACTIVE
created_at           timestamptz NOT NULL
updated_at           timestamptz NOT NULL
```

V1 constraint:

```text
UNIQUE(user_id)
```

This can be relaxed if multiple characters are introduced later.

## 7. character_stats

Frequently updated gameplay state is separated from identity.

```text
character_stats

character_id         uuid PK/FK -> characters.id
reputation           bigint NOT NULL DEFAULT 0
heat                 integer NOT NULL DEFAULT 0
health               integer NOT NULL DEFAULT 100
energy               integer NOT NULL DEFAULT 100
stress               integer NOT NULL DEFAULT 10
highest_net_worth    bigint NOT NULL DEFAULT 0
created_at           timestamptz NOT NULL
updated_at           timestamptz NOT NULL
```

Checks:

```text
heat BETWEEN 0 AND 100
health BETWEEN 0 AND 100
energy BETWEEN 0 AND 100
stress BETWEEN 0 AND 100
reputation >= 0
```

## 8. wallets

V1 character wallet.

```text
wallets

id                  uuid PK
character_id        uuid UNIQUE FK -> characters.id
cash_balance        bigint NOT NULL DEFAULT 0
bank_balance        bigint NOT NULL DEFAULT 0
version             bigint NOT NULL DEFAULT 0
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Checks:

```text
cash_balance >= 0
bank_balance >= 0
```

If debt is introduced later, represent it explicitly rather than silently allowing negative balances.

`version` may support optimistic concurrency where appropriate. Critical spend operations may additionally use row-level locking inside database transactions.

## 9. wallet_transactions

This is the immutable economic ledger.

```text
wallet_transactions

id                  uuid PK
wallet_id           uuid FK -> wallets.id
character_id        uuid FK -> characters.id
account             enum NOT NULL
transaction_type    enum NOT NULL
direction           enum NOT NULL
amount              bigint NOT NULL
balance_before      bigint NOT NULL
balance_after       bigint NOT NULL
reference_type      varchar NULL
reference_id        uuid NULL
idempotency_key     varchar NULL
correlation_id      varchar NULL
metadata            jsonb NULL
created_at          timestamptz NOT NULL
```

Account:

```text
CASH
BANK
```

Direction:

```text
CREDIT
DEBIT
```

Critical constraints:

```text
amount > 0
balance_before >= 0
balance_after >= 0
```

Recommended indexes:

```text
(wallet_id, created_at DESC)
(character_id, created_at DESC)
(transaction_type, created_at DESC)
(reference_type, reference_id)
```

Where appropriate, enforce uniqueness of idempotency keys within a defined player/action scope.

Ledger rows are never updated to rewrite history and never deleted as ordinary application behavior.

## 10. idempotency_records

Protect retryable mutation endpoints.

```text
idempotency_records

id                  uuid PK
user_id             uuid FK -> users.id
key                  varchar NOT NULL
operation            varchar NOT NULL
request_hash         varchar NOT NULL
status               enum NOT NULL
response_status      integer NULL
response_body        jsonb NULL
resource_type        varchar NULL
resource_id          uuid NULL
expires_at           timestamptz NULL
created_at           timestamptz NOT NULL
updated_at           timestamptz NOT NULL
```

Constraint:

```text
UNIQUE(user_id, operation, key)
```

If a key is reused with a different request hash, reject the request instead of silently executing it.

## 11. skills

Catalog table.

```text
skills

id                  uuid PK
code                varchar UNIQUE NOT NULL
name                varchar NOT NULL
description         text NULL
max_level           integer NOT NULL
is_active           boolean NOT NULL DEFAULT true
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Initial codes:

```text
BUSINESS
TECHNOLOGY
TRADING
SOCIAL
FITNESS
STREET
```

## 12. character_skills

```text
character_skills

character_id        uuid FK -> characters.id
skill_id            uuid FK -> skills.id
level               integer NOT NULL DEFAULT 1
xp                  bigint NOT NULL DEFAULT 0
updated_at          timestamptz NOT NULL

PRIMARY KEY(character_id, skill_id)
```

## 13. jobs

Configurable game content.

```text
jobs

id                  uuid PK
code                varchar UNIQUE NOT NULL
name                varchar NOT NULL
description         text NULL
base_reward         bigint NOT NULL
energy_cost         integer NOT NULL
stress_change       integer NOT NULL DEFAULT 0
cooldown_seconds    integer NOT NULL
required_skill_id   uuid NULL FK -> skills.id
required_skill_lvl  integer NULL
reputation_required bigint NOT NULL DEFAULT 0
is_active           boolean NOT NULL DEFAULT true
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

## 14. job_assignments

Tracks actual player job activity.

```text
job_assignments

id                  uuid PK
character_id        uuid FK -> characters.id
job_id              uuid FK -> jobs.id
status              enum NOT NULL
started_at          timestamptz NOT NULL
completes_at        timestamptz NOT NULL
completed_at        timestamptz NULL
reward_amount       bigint NULL
transaction_id      uuid NULL FK -> wallet_transactions.id
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Statuses:

```text
ACTIVE
COMPLETED
CANCELLED
EXPIRED
```

Completion must be idempotent.

## 15. hustles

Fictional abstract risk/reward content. Do not store operational real-world fraud instructions or victim/payment details.

```text
hustles

id                    uuid PK
code                  varchar UNIQUE NOT NULL
name                  varchar NOT NULL
description           text NULL
tier                  integer NOT NULL
entry_cost            bigint NOT NULL DEFAULT 0
reward_min            bigint NOT NULL
reward_max            bigint NOT NULL
base_success_bps      integer NOT NULL
energy_cost           integer NOT NULL
stress_min            integer NOT NULL DEFAULT 0
stress_max            integer NOT NULL DEFAULT 0
heat_min              integer NOT NULL DEFAULT 0
heat_max              integer NOT NULL DEFAULT 0
reputation_min        integer NOT NULL DEFAULT 0
reputation_max        integer NOT NULL DEFAULT 0
cooldown_seconds      integer NOT NULL
required_reputation   bigint NOT NULL DEFAULT 0
required_skill_id     uuid NULL FK -> skills.id
required_skill_level  integer NULL
is_active             boolean NOT NULL DEFAULT true
created_at            timestamptz NOT NULL
updated_at            timestamptz NOT NULL
```

Use basis points for probabilities where useful:

```text
7000 = 70.00%
```

## 16. hustle_attempts

Stores the authoritative outcome.

```text
hustle_attempts

id                  uuid PK
character_id        uuid FK -> characters.id
hustle_id           uuid FK -> hustles.id
outcome             enum NOT NULL
entry_cost          bigint NOT NULL
reward_amount       bigint NOT NULL DEFAULT 0
heat_change         integer NOT NULL DEFAULT 0
reputation_change   integer NOT NULL DEFAULT 0
stress_change       integer NOT NULL DEFAULT 0
rng_version         varchar NOT NULL
started_at          timestamptz NOT NULL
resolved_at         timestamptz NOT NULL
created_at          timestamptz NOT NULL
```

Do not store sensitive operational crime data because the game does not simulate it.

Outcomes:

```text
BIG_WIN
SUCCESS
PARTIAL_SUCCESS
FAILURE
DISASTER
```

Economic ledger entries reference the attempt.

## 17. heat_events

Append-only history of meaningful Heat changes.

```text
heat_events

id                  uuid PK
character_id        uuid FK -> characters.id
source_type         varchar NOT NULL
source_id           uuid NULL
change              integer NOT NULL
heat_before         integer NOT NULL
heat_after          integer NOT NULL
metadata            jsonb NULL
created_at          timestamptz NOT NULL
```

This helps debugging and balancing.

## 18. reputation_events

Same pattern:

```text
reputation_events

id                  uuid PK
character_id        uuid FK -> characters.id
source_type         varchar NOT NULL
source_id           uuid NULL
change              bigint NOT NULL
reputation_before   bigint NOT NULL
reputation_after    bigint NOT NULL
metadata            jsonb NULL
created_at          timestamptz NOT NULL
```

## 19. locations

```text
locations

id                  uuid PK
code                varchar UNIQUE NOT NULL
name                varchar NOT NULL
district            varchar NOT NULL
type                enum NOT NULL
map_x               numeric NULL
map_y               numeric NULL
reputation_required bigint NOT NULL DEFAULT 0
metadata            jsonb NULL
is_active           boolean NOT NULL DEFAULT true
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Location types include HOME, CLUB, BANK, OFFICE, SHOP, DEALERSHIP, GYM, HOSPITAL, BUSINESS, and PUBLIC.

## 20. property_catalog

Defines purchasable/rentable property types.

```text
property_catalog

id                  uuid PK
code                varchar UNIQUE NOT NULL
name                varchar NOT NULL
location_id         uuid FK -> locations.id
purchase_price      bigint NULL
rent_price          bigint NULL
reputation_bonus    bigint NOT NULL DEFAULT 0
energy_bonus        integer NOT NULL DEFAULT 0
storage_capacity    integer NOT NULL DEFAULT 0
base_value          bigint NOT NULL
is_active           boolean NOT NULL DEFAULT true
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

## 21. player_properties

```text
player_properties

id                  uuid PK
character_id        uuid FK -> characters.id
property_id         uuid FK -> property_catalog.id
tenure_type         enum NOT NULL
acquisition_price   bigint NOT NULL
current_value       bigint NOT NULL
rent_due_at         timestamptz NULL
acquired_at         timestamptz NOT NULL
sold_at             timestamptz NULL
status              enum NOT NULL DEFAULT ACTIVE
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Tenure:

```text
OWNED
RENTED
```

Status may include ACTIVE, SOLD, REPOSSESSED, EXPIRED.

## 22. vehicle_catalog

```text
vehicle_catalog

id                  uuid PK
code                varchar UNIQUE NOT NULL
name                varchar NOT NULL
class               enum NOT NULL
purchase_price      bigint NOT NULL
base_value          bigint NOT NULL
reputation_bonus    bigint NOT NULL DEFAULT 0
maintenance_cost    bigint NOT NULL DEFAULT 0
metadata            jsonb NULL
is_active           boolean NOT NULL DEFAULT true
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Use fictional brands/classes in V1 unless licensing is deliberately addressed.

## 23. player_vehicles

```text
player_vehicles

id                  uuid PK
character_id        uuid FK -> characters.id
vehicle_id          uuid FK -> vehicle_catalog.id
purchase_price      bigint NOT NULL
current_value       bigint NOT NULL
condition           integer NOT NULL DEFAULT 100
acquired_at         timestamptz NOT NULL
sold_at             timestamptz NULL
status              enum NOT NULL DEFAULT ACTIVE
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Checks:

```text
condition BETWEEN 0 AND 100
```

## 24. business_types

```text
business_types

id                    uuid PK
code                  varchar UNIQUE NOT NULL
name                  varchar NOT NULL
description           text NULL
startup_cost          bigint NOT NULL
base_revenue          bigint NOT NULL
base_operating_cost   bigint NOT NULL
reputation_bonus      bigint NOT NULL DEFAULT 0
required_skill_id     uuid NULL FK -> skills.id
required_skill_level  integer NULL
is_active             boolean NOT NULL DEFAULT true
created_at            timestamptz NOT NULL
updated_at            timestamptz NOT NULL
```

## 25. player_businesses

```text
player_businesses

id                  uuid PK
character_id        uuid FK -> characters.id
business_type_id    uuid FK -> business_types.id
location_id         uuid FK -> locations.id
name                varchar NOT NULL
level               integer NOT NULL DEFAULT 1
valuation           bigint NOT NULL
cash_reserve        bigint NOT NULL DEFAULT 0
status              enum NOT NULL DEFAULT ACTIVE
started_at          timestamptz NOT NULL
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

## 26. business_cycles

Each payout period is recorded explicitly.

```text
business_cycles

id                  uuid PK
business_id         uuid FK -> player_businesses.id
period_start        timestamptz NOT NULL
period_end          timestamptz NOT NULL
gross_revenue       bigint NOT NULL
operating_cost      bigint NOT NULL
net_profit          bigint NOT NULL
modifiers           jsonb NULL
transaction_id      uuid NULL FK -> wallet_transactions.id
processed_at        timestamptz NOT NULL
created_at          timestamptz NOT NULL
```

Constraint:

```text
UNIQUE(business_id, period_start, period_end)
```

This protects payout jobs from duplication.

## 27. items

```text
items

id                  uuid PK
code                varchar UNIQUE NOT NULL
name                varchar NOT NULL
category             enum NOT NULL
purchase_price       bigint NULL
reputation_bonus     bigint NOT NULL DEFAULT 0
metadata             jsonb NULL
is_active             boolean NOT NULL DEFAULT true
created_at            timestamptz NOT NULL
updated_at            timestamptz NOT NULL
```

## 28. character_items

```text
character_items

id                  uuid PK
character_id        uuid FK -> characters.id
item_id             uuid FK -> items.id
quantity            integer NOT NULL DEFAULT 1
durability          integer NULL
is_equipped         boolean NOT NULL DEFAULT false
acquired_at         timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

## 29. relationships

V1 NPC relationships:

```text
relationships

id                  uuid PK
character_id        uuid FK -> characters.id
npc_id              uuid FK -> npcs.id
status              enum NOT NULL
attraction          integer NOT NULL DEFAULT 0
trust               integer NOT NULL DEFAULT 0
loyalty             integer NOT NULL DEFAULT 0
compatibility       integer NOT NULL DEFAULT 0
started_at          timestamptz NULL
ended_at            timestamptz NULL
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Checks for relationship scores: 0–100.

## 30. npcs

```text
npcs

id                    uuid PK
code                  varchar UNIQUE NOT NULL
name                  varchar NOT NULL
location_id           uuid NULL FK -> locations.id
personality            jsonb NOT NULL
lifestyle_expectation integer NOT NULL DEFAULT 0
is_active             boolean NOT NULL DEFAULT true
created_at            timestamptz NOT NULL
updated_at            timestamptz NOT NULL
```

V1 NPC behavior is deterministic/config-driven, not LLM-dependent.

## 31. relationship_events

```text
relationship_events

id                  uuid PK
relationship_id     uuid FK -> relationships.id
event_type          varchar NOT NULL
choice              varchar NULL
trust_change        integer NOT NULL DEFAULT 0
loyalty_change      integer NOT NULL DEFAULT 0
attraction_change   integer NOT NULL DEFAULT 0
cost_amount         bigint NOT NULL DEFAULT 0
metadata            jsonb NULL
created_at          timestamptz NOT NULL
```

## 32. trading_instruments

Fictional simulation instruments.

```text
trading_instruments

id                  uuid PK
code                varchar UNIQUE NOT NULL
name                varchar NOT NULL
instrument_type     enum NOT NULL
current_price_units bigint NOT NULL
volatility_bps      integer NOT NULL
is_active           boolean NOT NULL DEFAULT true
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Use integer price units or a fixed decimal type; never binary floating point for financial calculations.

## 33. market_ticks

```text
market_ticks

id                  bigserial PK
instrument_id       uuid FK -> trading_instruments.id
price_units         bigint NOT NULL
recorded_at         timestamptz NOT NULL
```

Index:

```text
(instrument_id, recorded_at DESC)
```

Retention/aggregation policy may be added as data grows.

## 34. trading_positions

```text
trading_positions

id                  uuid PK
character_id        uuid FK -> characters.id
instrument_id       uuid FK -> trading_instruments.id
direction           enum NOT NULL
risk_tier           enum NOT NULL
stake_amount        bigint NOT NULL
entry_price_units   bigint NOT NULL
exit_price_units    bigint NULL
status              enum NOT NULL
opened_at           timestamptz NOT NULL
closes_at           timestamptz NOT NULL
closed_at           timestamptz NULL
pnl_amount          bigint NULL
transaction_id      uuid NULL FK -> wallet_transactions.id
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

This is a fictional game system, not a real brokerage ledger.

## 35. law_cases

Fictional consequence system.

```text
law_cases

id                  uuid PK
character_id        uuid FK -> characters.id
case_type           varchar NOT NULL
status              enum NOT NULL
heat_at_open        integer NOT NULL
legal_cost          bigint NOT NULL DEFAULT 0
fines               bigint NOT NULL DEFAULT 0
sentence_periods    integer NOT NULL DEFAULT 0
opened_at           timestamptz NOT NULL
resolved_at         timestamptz NULL
metadata            jsonb NULL
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

Do not model real investigative procedures or evasion tactics.

## 36. asset_restrictions

Tracks fictional freezes/seizures without deleting ownership history.

```text
asset_restrictions

id                  uuid PK
case_id             uuid FK -> law_cases.id
character_id        uuid FK -> characters.id
asset_type          varchar NOT NULL
asset_id            uuid NOT NULL
restriction_type    enum NOT NULL
status              enum NOT NULL
created_at          timestamptz NOT NULL
resolved_at         timestamptz NULL
```

## 37. achievements

Catalog:

```text
achievements

id                  uuid PK
code                varchar UNIQUE NOT NULL
name                varchar NOT NULL
description         text NOT NULL
category            varchar NOT NULL
criteria            jsonb NOT NULL
reputation_reward   bigint NOT NULL DEFAULT 0
is_active           boolean NOT NULL DEFAULT true
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

## 38. character_achievements

```text
character_achievements

character_id        uuid FK -> characters.id
achievement_id      uuid FK -> achievements.id
unlocked_at         timestamptz NOT NULL
metadata            jsonb NULL

PRIMARY KEY(character_id, achievement_id)
```

## 39. world_events

```text
world_events

id                  uuid PK
code                varchar UNIQUE NOT NULL
name                varchar NOT NULL
description         text NOT NULL
status              enum NOT NULL
starts_at           timestamptz NOT NULL
ends_at             timestamptz NOT NULL
modifiers            jsonb NOT NULL
created_at           timestamptz NOT NULL
updated_at           timestamptz NOT NULL
```

Modifiers are interpreted by defined game-rule code; never execute arbitrary code stored in the database.

## 40. notifications

```text
notifications

id                  uuid PK
user_id             uuid FK -> users.id
character_id        uuid NULL FK -> characters.id
type                varchar NOT NULL
title               varchar NOT NULL
body                text NOT NULL
data                jsonb NULL
read_at             timestamptz NULL
created_at          timestamptz NOT NULL
```

Index:

```text
(user_id, created_at DESC)
```

## 41. follows

Basic social graph:

```text
follows

follower_character_id   uuid FK -> characters.id
followed_character_id   uuid FK -> characters.id
created_at              timestamptz NOT NULL

PRIMARY KEY(follower_character_id, followed_character_id)
```

Check that a character cannot follow itself.

## 42. leaderboard_snapshots

Leaderboards may be calculated from authoritative data and cached in Redis. Historical snapshots can be stored:

```text
leaderboard_snapshots

id                  uuid PK
leaderboard_type    varchar NOT NULL
period_key          varchar NOT NULL
rankings            jsonb NOT NULL
created_at          timestamptz NOT NULL
```

Do not treat this as the source of truth for player wealth.

## 43. economy_snapshots

```text
player_economy_snapshots

id                  uuid PK
character_id        uuid FK -> characters.id
cash_balance        bigint NOT NULL
bank_balance        bigint NOT NULL
property_value      bigint NOT NULL
vehicle_value       bigint NOT NULL
business_value      bigint NOT NULL
investment_value    bigint NOT NULL
debt_value          bigint NOT NULL DEFAULT 0
net_worth           bigint NOT NULL
period_income       bigint NOT NULL DEFAULT 0
period_expenses     bigint NOT NULL DEFAULT 0
heat                integer NOT NULL
reputation          bigint NOT NULL
created_at          timestamptz NOT NULL
```

Index:

```text
(character_id, created_at DESC)
```

## 44. economy_config

Versioned game configuration.

```text
economy_config

id                  uuid PK
key                 varchar NOT NULL
value               jsonb NOT NULL
version             integer NOT NULL
effective_from      timestamptz NOT NULL
effective_until     timestamptz NULL
created_by          uuid NULL FK -> users.id
created_at          timestamptz NOT NULL

UNIQUE(key, version)
```

Examples:

```text
STARTING_CASH
STARTING_BANK
BASE_HEAT_DECAY
ENERGY_RECOVERY_RATE
BUSINESS_PAYOUT_INTERVAL
```

## 45. advertisers

Only legitimate approved advertisers belong here.

```text
advertisers

id                  uuid PK
name                varchar NOT NULL
status              enum NOT NULL
website_url         varchar NULL
metadata            jsonb NULL
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

## 46. ad_campaigns

```text
ad_campaigns

id                  uuid PK
advertiser_id       uuid FK -> advertisers.id
name                varchar NOT NULL
status              enum NOT NULL
starts_at           timestamptz NOT NULL
ends_at             timestamptz NOT NULL
landing_url         varchar NULL
created_at          timestamptz NOT NULL
updated_at          timestamptz NOT NULL
```

## 47. ad_creatives and placements

```text
ad_creatives

id                  uuid PK
campaign_id         uuid FK -> ad_campaigns.id
creative_type       enum NOT NULL
asset_url           varchar NOT NULL
alt_text            varchar NULL
status              enum NOT NULL
created_at          timestamptz NOT NULL
```

```text
ad_placements

id                  uuid PK
code                varchar UNIQUE NOT NULL
location_id         uuid NULL FK -> locations.id
placement_type      enum NOT NULL
metadata            jsonb NULL
is_active           boolean NOT NULL DEFAULT true
```

```text
campaign_placements

campaign_id         uuid FK -> ad_campaigns.id
placement_id        uuid FK -> ad_placements.id

PRIMARY KEY(campaign_id, placement_id)
```

## 48. ad_events

```text
ad_events

id                  bigserial PK
campaign_id         uuid FK -> ad_campaigns.id
creative_id         uuid FK -> ad_creatives.id
placement_id        uuid FK -> ad_placements.id
character_id        uuid NULL FK -> characters.id
event_type          enum NOT NULL
session_id          varchar NULL
created_at          timestamptz NOT NULL
```

Event types:

```text
IMPRESSION
CLICK
```

High-volume analytics may later move to specialized storage, but V1 can begin relationally.

## 49. analytics_events

Generic product analytics event stream:

```text
analytics_events

id                  bigserial PK
user_id             uuid NULL
character_id        uuid NULL
event_name          varchar NOT NULL
properties          jsonb NULL
session_id          varchar NULL
occurred_at         timestamptz NOT NULL
```

Indexes should reflect actual analytics queries; avoid indexing every JSON property.

## 50. admin_audit_logs

Append-only administrative audit trail.

```text
admin_audit_logs

id                  uuid PK
admin_user_id       uuid FK -> users.id
action              varchar NOT NULL
target_type         varchar NOT NULL
target_id           uuid NULL
reason              text NULL
before_state        jsonb NULL
after_state         jsonb NULL
request_id          varchar NULL
created_at          timestamptz NOT NULL
```

Never silently alter player money or assets.

## 51. feature_flags

```text
feature_flags

key                 varchar PK
enabled             boolean NOT NULL DEFAULT false
configuration       jsonb NULL
updated_by          uuid NULL FK -> users.id
updated_at          timestamptz NOT NULL
```

Examples:

```text
trading.enabled
nightlife.enabled
relationships.enabled
world_map.enabled
advertising.enabled
```

## 52. Game Content vs Player State

Keep this distinction explicit.

Content/configuration:

```text
jobs
hustles
vehicle_catalog
property_catalog
business_types
items
skills
locations
achievements
```

Player state:

```text
job_assignments
hustle_attempts
player_vehicles
player_properties
player_businesses
character_items
character_skills
character_achievements
```

Never mutate catalog records to represent one player's ownership.

## 53. Monetary Data Types

Use integer `BIGINT` values for HK₦ amounts unless a later design explicitly requires subunits.

Correct:

```text
2500000
```

means HK₦2,500,000.

Never use JavaScript `number` carelessly for unbounded monetary arithmetic. API/domain code should use safe integer strategies and serialize values consistently. If balances can approach JavaScript's safe-integer limit, use `bigint`/string serialization at boundaries.

## 54. Transaction Boundary — Job Completion

One database transaction should:

```text
Lock/validate assignment

Verify ACTIVE

Verify completion time

Calculate authoritative reward

Credit wallet

Insert ledger record

Update assignment to COMPLETED

Update energy/stress if applicable

Insert analytics/domain outbox record if used

COMMIT
```

A retry returns the original completion result.

## 55. Transaction Boundary — Hustle Attempt

```text
Validate hustle
Validate cooldown
Validate requirements
Validate energy
Validate entry cost
Generate server-side outcome

BEGIN DB TRANSACTION

Debit entry cost if required
Create ledger debit
Create hustle attempt
Apply reward if successful
Create reward ledger credit
Update heat
Insert heat event
Update reputation
Insert reputation event
Update energy/stress

COMMIT
```

No partial success at the database-consistency level. `PARTIAL_SUCCESS` is a game outcome, not a partially committed transaction.

## 56. Transaction Boundary — Vehicle Purchase

```text
BEGIN

Lock wallet
Read server-side vehicle price
Validate funds
Debit wallet
Create ledger entry
Create player_vehicles row
Apply reputation bonus
Create reputation event

COMMIT
```

Client-provided price is ignored.

## 57. Transaction Boundary — Business Payout

Worker processes a unique business cycle:

```text
BEGIN

Create/lock unique business cycle
Calculate revenue
Calculate expenses
Calculate net profit
Create appropriate ledger entries
Update business valuation/state
Mark cycle processed

COMMIT
```

The unique period constraint prevents duplicate payouts.

## 58. Outbox Pattern

For important domain events that must be emitted after a successful database transaction, V1 should strongly consider a transactional outbox.

```text
domain_outbox

id                  uuid PK
event_type          varchar NOT NULL
aggregate_type      varchar NOT NULL
aggregate_id        uuid NOT NULL
payload             jsonb NOT NULL
status              enum NOT NULL DEFAULT PENDING
attempts            integer NOT NULL DEFAULT 0
available_at        timestamptz NOT NULL
processed_at        timestamptz NULL
created_at          timestamptz NOT NULL
```

This prevents the classic problem:

```text
DB commit succeeds
↓
process crashes
↓
event never reaches queue
```

A worker publishes/processes pending outbox events idempotently.

## 59. Deletion Policy

Never hard-delete:

```text
wallet_transactions
hustle_attempts with economic impact
business_cycles
admin_audit_logs
law-case financial history
economy snapshots needed for audit
```

User privacy/deletion requirements should be handled through a deliberate account-deletion/anonymization process without corrupting economic integrity.

## 60. Index Strategy

Start with indexes supporting known access patterns rather than speculative indexing.

Important candidates:

```text
wallet_transactions(wallet_id, created_at DESC)
job_assignments(character_id, status)
hustle_attempts(character_id, created_at DESC)
player_properties(character_id, status)
player_vehicles(character_id, status)
player_businesses(character_id, status)
notifications(user_id, read_at, created_at DESC)
market_ticks(instrument_id, recorded_at DESC)
analytics_events(event_name, occurred_at DESC)
```

Review slow-query metrics before adding more.

## 61. Pagination

Large histories use cursor pagination.

Examples:

```text
wallet transactions
notifications
analytics
public activity
```

Avoid deep `OFFSET` pagination for very large tables.

## 62. Concurrency Rules

Critical economic operations must assume simultaneous requests.

Use one or more of:

```text
PostgreSQL row locks
atomic conditional updates
unique constraints
transaction isolation
optimistic version checks
```

Do not rely on application-memory locks because multiple API instances will eventually exist.

## 63. Redis Is Not the Ledger

Redis may cache:

```text
leaderboards
presence
configuration
public profile summaries
```

But if Redis disappears, permanent player wealth must remain intact.

The database is authoritative.

## 64. Prisma Rules

Codex must:

- create explicit Prisma models and relations;
- generate reviewed migrations;
- avoid using `db push` as the production migration strategy;
- use Prisma transactions for atomic workflows where appropriate;
- avoid exposing Prisma directly from controllers;
- keep domain logic in services/game-rule modules;
- use raw SQL only when justified and documented.

## 65. Seed Data

Development seed should create:

```text
6 skills
starter jobs
starter hustles
several locations
property catalog
vehicle catalog
business types
basic achievements
initial economy configuration
feature flags
```

Seed data must never contain real credentials or production secrets.

## 66. Test Fixtures

Tests should provide factories/builders for:

```text
User
Character
Wallet
Job
Hustle
Vehicle
Property
Business
```

Tests must not depend on production-like global seed state unless explicitly integration-testing seeded content.

## 67. Database Invariants

The following are non-negotiable:

1. A character has at most one V1 wallet.
2. Wallet balances cannot silently change without ledger entries.
3. Completed job assignments cannot pay twice.
4. A business cycle cannot pay twice.
5. Idempotency-key retries cannot duplicate mutations.
6. Heat remains between 0 and 100.
7. Health, energy, and stress remain within configured bounds.
8. Catalog prices are server-controlled.
9. Historical ledger rows are immutable.
10. Admin economic adjustments are ledgered and audited.

## 68. Initial Migration Order

Recommended implementation order:

```text
001 users + auth sessions
002 locations + characters + character stats
003 wallets + wallet transactions + idempotency
004 skills + character skills
005 jobs + job assignments
006 hustles + hustle attempts + heat/reputation events
007 items + inventory
008 properties
009 vehicles
010 businesses + business cycles
011 trading
012 NPCs + relationships
013 law cases + asset restrictions
014 achievements + notifications + social
015 world events + config + feature flags
016 advertising
017 analytics + snapshots + audit logs + outbox
```

Exact migration grouping may change during implementation, but dependency order should remain coherent.

## 69. V1 Database Definition of Done

The database foundation is ready when:

```text
Prisma schema compiles

Migrations run from an empty database

Seed succeeds

Core constraints are enforced

Wallet/ledger integration tests pass

Idempotency tests pass

Concurrent-spend test passes

Job duplicate-payment test passes

Business duplicate-payout test passes

Database can be rebuilt locally from migrations + seed
```

## 70. Final Principle

The schema should make the correct behavior easy and dangerous behavior difficult.

The application should not merely *hope* that a player cannot receive the same HK₦1,000,000 reward twice. Unique constraints, transactions, idempotency records, ledger history, and tests should make that failure structurally difficult.

For Hustling Kingdom, economic integrity is part of gameplay integrity.
