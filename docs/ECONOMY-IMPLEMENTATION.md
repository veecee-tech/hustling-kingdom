# Phase 3 economy implementation

Implementation notes subordinate to the approved specifications. Only EconomyModule
may write game money. No public credit, debit, balance setter, admin adjustment or
real-money operation exists. Jobs and all later gameplay remain unimplemented.

## Durable accounting

Wallets materialize cash/bank BIGINT balances, starting at zero. The ledger stores
positive amounts, explicit account/direction, before/after balances, UUID ownership,
type, reference, idempotency key, server correlation and timestamps. JSON responses
use decimal strings without conversion through JavaScript Number. Amounts must be
positive canonical decimal strings within signed PostgreSQL BIGINT; totals may be
larger than one account and remain lossless strings.

The SQL migration is transactional. A ledger BEFORE INSERT trigger locks its wallet,
validates ownership, arithmetic and continuity with the last account entry, assigns
the next wallet-local sequence, then materializes the new balance/version. Application
code never directly updates a wallet balance. The extra sequence supports deterministic
newest-first history even when timestamps match; external resource IDs remain UUIDs.

Deferred wallet checks require balances/version to match ledger endpoints and exactly
two starting origins at commit. Empty/unfunded wallets cannot commit. Wallet creation
with nonzero balances is rejected. Unique starting-type indexes prevent duplicate
funding. Foreign keys restrict removal of funded characters and economic history.
Ledger UPDATE, DELETE and TRUNCATE are rejected; completed retry receipts also reject
UPDATE/DELETE. Transfers require two opposite account entries, matching correlation,
type and idempotency key, and zero net change at commit.

These protections target ordinary application SQL, not a database administrator.
Production application credentials must not own schema objects, alter triggers,
truncate tables or impersonate an owner. Use a separate migration role. Local Compose
credentials are development-only. Corrections require reviewed compensating entries,
never disabled triggers or historical edits.

## Transaction ownership and concurrency

EconomyService exposes internal `credit`, `debit`, transfer, wallet/history reads,
initialization and reconciliation. Internal credit/debit require an authenticated
actor, positive bigint amount, explicit CASH/BANK account and bounded server-owned
reference. Their SYSTEM_CREDIT/SYSTEM_DEBIT types are foundational internal semantics,
not implemented reward/expense gameplay. Future domains must obtain authoritative
amounts themselves and call this boundary. Background/system-actor policies and future
cross-domain workflows require explicit implementation in their own phases.

Mutation lock order is User then Wallet. The User lock matches authentication and
character creation, so session/account eligibility can be checked again after waiting
for it. PostgreSQL locks serialize requests across API instances, independent of Redis
and browser buttons. The ledger trigger also locks the wallet for direct SQL safety.
No insufficient debit, overflowed destination, failed receipt or partial transfer
commits. Failures roll back balances, both ledger sides and the receipt together.

## Retry receipts

Idempotency records are unique by user + operation + key. Fingerprints use canonical
validated amount/account/reference data. Same key and same payload return the original
200 response, including after later moves; different intent returns IDEMPOTENCY_CONFLICT.
Completed records commit atomically with the operation. No pending placeholder is
committed: failed requests retain no receipt, so a later retry may succeed if its
precondition changes. Financial receipts have no expiry in this phase.

Starting funding instead uses a single wallet per character and unique starting
ledger types. Phase 2's character creation receipt remains intact; it is not rewritten
or silently migrated to generic economy receipts.

## Initialization and operations

New character creation calls EconomyService inside the same database transaction as
identity, stats and the character receipt. Both 15,000 CASH and 5,000 BANK origin
entries must commit with it. No manual balance seeding is used.

For existing Phase 2 characters, run:

```sh
pnpm prisma:deploy
pnpm prisma:generate
pnpm economy:backfill
pnpm economy:reconcile
```

Run backfill before reopening player traffic after deployment. The command scans in
bounded batches, locks each owner, initializes missing wallets atomically and skips
existing wallets. It is safe to rerun or run concurrently. Reconciliation uses a
repeatable database snapshot and independently sums credits minus debits for each
account. It reports counts/mismatches only, never personal data, and returns failure
on a mismatch or missing wallet. It detects; it never auto-corrects.

For the local initial implementation, a SQL function syntax error caused an incomplete
schema application. The corrected remaining statements were applied and Prisma's
migration was resolved as applied; no existing player balances or data were edited.
The reviewed migration now wraps all statements in BEGIN/COMMIT for fresh deployments.

`highest_net_worth` remains a deferred progression statistic. The UI presents liquid
cash + bank, not total asset net worth. No asset domains or wealth tiers are implemented.

## REST and privacy

- GET `/api/v1/wallet`: `{ cash, bank, total, version }`, all decimal strings.
- GET `/api/v1/wallet/transactions?limit=20&cursor=...`: safe entries and nextCursor.
  Limit 1–50; UUID cursor is scoped to the owner; newest sequence first.
- POST `/api/v1/wallet/deposit`: `{ "amount": "5000" }`, cash → bank.
- POST `/api/v1/wallet/withdraw`: same shape, bank → cash.

Mutations require an 8–128 character Idempotency-Key using ASCII alphanumeric,
underscore or hyphen. All endpoints require Bearer authentication and derive the
character/wallet from the principal. Unknown body/query properties are rejected.
There is no caller-supplied owner/wallet ID. Responses disable caching and omit
internal receipt, reference, correlation, metadata and ownership fields. Entry UUIDs
are opaque stable list/cursor identities, not rendered as player-facing content.
OpenAPI documents request shapes, decimal money, cursors, authentication and errors.

Errors include CHARACTER_REQUIRED, WALLET_REQUIRED, INVALID_AMOUNT,
INSUFFICIENT_FUNDS, IDEMPOTENCY_CONFLICT and TRANSACTION_CONFLICT, with the established
safe request-ID envelope. Mutations use an additional Redis-backed limit of 30 per
account/minute, failing closed on rate-service failure. This supplements accounting;
Redis contains no balance truth. Economic logs use operation and server request ID,
never payloads, tokens, credentials or unnecessary personal data.

## Tests and retained fixtures

Existing quality commands discover economy rules, real database/API integration,
wallet-store/components and mobile browser flows. Integration tests exercise 20
concurrent spends, parallel retries, SQL immutability/consistency guards, destination
overflow rollback, legacy initialization, privacy and pagination. Character creation
also tests economic-initialization rollback. Existing authentication/character/health
regressions remain in the same suites.

Funded test identities remain in development PostgreSQL: accounting history is not
deleted or protections disabled for cleanup. Only unfunded account fixtures are
removed. Randomized identifiers isolate runs. Browser fixtures continue to remain.
Use disposable databases for full test database lifecycle cleanup.
