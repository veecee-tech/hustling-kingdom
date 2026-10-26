# HUSTLING KINGDOM — API.md

**Version:** 1.0  
**Status:** V1 API Contract  
**Base Path:** `/api/v1`  
**Transport:** HTTPS REST + Socket.IO

## Core Contract
The client requests actions; the server validates and determines outcomes. The client never supplies authoritative balances, rewards, prices, ownership, Heat, reputation, market results, or success probabilities.

Use JSON, opaque IDs, ISO-8601 UTC timestamps, integer game-currency amounts, stable error codes, and a server request ID on every request.

## Standard Error
```json
{"error":{"code":"INSUFFICIENT_FUNDS","message":"You do not have enough funds for this purchase.","details":{},"requestId":"req_..."}}
```

## Authentication
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /me`

Use short-lived access tokens and rotating/revocable refresh sessions.

## Character
- `POST /characters` — idempotent creation.
- `GET /characters/me`
- `PATCH /characters/me/appearance`

Creation atomically creates character, wallet/accounts, stats, and HK₦15,000 cash + HK₦5,000 bank ledger entries. The client never submits starting money.

## Dashboard
- `GET /dashboard`

Aggregate character stats, wallet/net worth, Heat, reputation, health/energy/stress, active job, key assets/businesses, recent transactions, notifications and active world events.

## Wallet
- `GET /wallet`
- `GET /wallet/transactions`
- `POST /wallet/deposit`
- `POST /wallet/withdraw`

Ledger entries are immutable. Deposit/withdraw only move fictional currency between game accounts.

## Jobs
- `GET /jobs`
- `POST /jobs/:jobId/start`
- `GET /jobs/active`
- `POST /jobs/assignments/:assignmentId/complete`

The server validates eligibility, cooldown, energy and assignment state and calculates reward. Completion atomically updates assignment, wallet/ledger and applicable stats.

## Skills
- `GET /skills`
- `GET /skills/catalog`

No generic endpoint directly sets XP/skill levels.

## Hustles
- `GET /hustles`
- `POST /hustles/:hustleId/attempt`

Underground gameplay is fictional and abstract. The request contains no success or reward. The server determines outcome, reward/loss, Heat, reputation, energy and stress atomically.

Never model real victim data, credentials, laundering routes, criminal contacts, payment-account access or operational fraud instructions.

## Heat / Reputation
- `GET /heat`
- `GET /heat/history`
- `GET /reputation`

No public setters.

## Vehicles
- `GET /vehicles`
- `GET /vehicles/:vehicleId`
- `GET /vehicles/owned`
- `POST /vehicles/:vehicleId/purchase`
- `POST /vehicles/owned/:ownershipId/sell`
- `POST /vehicles/owned/:ownershipId/service`

Prices/resale values are server-controlled. Economic mutations require idempotency.

## Properties
- `GET /properties`
- `GET /properties/:propertyId`
- `GET /properties/owned`
- `POST /properties/:propertyId/purchase`
- `POST /properties/:propertyId/rent`
- `POST /properties/owned/:ownershipId/sell`

## Businesses
- `GET /businesses/catalog`
- `GET /businesses/owned`
- `GET /businesses/owned/:businessId`
- `POST /businesses`
- `POST /businesses/:businessId/upgrade`
- `GET /businesses/:businessId/cycles`

Periodic payouts are worker-driven; do not expose a spam-able claim-profit endpoint.

## Fictional Trading
- `GET /markets`
- `GET /markets/:instrumentId/history`
- `GET /trading/positions`
- `POST /trading/positions`
- `POST /trading/positions/:positionId/close`

Server owns price state, execution, limits, outcomes and settlement. Client never supplies profit/loss.

## Inventory
- `GET /inventory`
- `GET /items`
- `POST /items/:itemId/purchase`
- `POST /inventory/:ownershipId/equip`

## Relationships / Nightlife
- `GET /relationships`
- `GET /relationships/:id`
- `POST /relationships/:id/actions`
- `GET /nightlife/venues`
- `GET /nightlife/events`
- `POST /nightlife/events/:id/attend`
- `POST /nightlife/events/:id/purchases`

Server controls costs and stat changes.

## City / World
- `GET /locations`
- `GET /locations/:id`
- `POST /locations/:id/enter`
- `POST /locations/:id/leave`
- `GET /world-events/active`
- `GET /world-events/history`

Pixel movement is realtime/ephemeral, not written continuously to PostgreSQL.

## Fictional Case System
- `GET /cases`
- `GET /cases/:id`
- `POST /cases/:id/actions`

Expose abstract gameplay consequences only; do not model real investigative/evasion procedures.

## Achievements / Profiles / Social
- `GET /achievements`
- `GET /achievements/recent`
- `GET /players/:username`
- `POST /players/:id/follow`
- `DELETE /players/:id/follow`
- `GET /players/:id/followers`
- `GET /players/:id/following`

Public profiles never expose email, sessions, private ledger, security flags, moderation notes or private relationship data.

## Leaderboards
- `GET /leaderboards/:type`

Types: `NET_WORTH`, `REPUTATION`, `BUSINESS_EMPIRE`, `PROPERTY`, `TRADING`, `FASTEST_RISING`. Prefer cached/precomputed rankings.

## Notifications / Share Cards
- `GET /notifications`
- `POST /notifications/:id/read`
- `POST /notifications/read-all`
- `POST /share-cards`
- `GET /share-cards/:id`

## Advertising
- `GET /ads/placements/:placementKey`
- `POST /ads/impressions`
- `POST /ads/clicks`

Use server-issued impression identifiers. Reject illicit real-world advertising.

## Features / Config
- `GET /features`
- `GET /game-config/public`

Never expose hidden probabilities, anti-cheat thresholds or secrets.

## Socket.IO
Server events:
`notification:new`, `world-event:started`, `world-event:ended`, `market:tick`, `presence:joined`, `presence:left`, `presence:moved`, `leaderboard:updated`.

Client events:
`presence:enter-location`, `presence:leave-location`, `presence:move`.

Sockets are authenticated. Economic mutations remain REST/domain actions.

## Pagination
Use cursor pagination for growing collections such as ledger entries, followers and notifications.

## Idempotency
Retry-sensitive economic mutations require `Idempotency-Key`.

Persist actor, action, key, request fingerprint, status and result. Same key/same operation returns the stored result; conflicting reuse returns `IDEMPOTENCY_CONFLICT`.

Idempotency does not replace database transactions or concurrency controls.

## Concurrency
Prevent double spend, duplicate ownership, duplicate payout, repeated completion and simultaneous settlement with PostgreSQL transactions, constraints and appropriate locking/version techniques.

## Admin API
Protected under `/api/v1/admin`.

Initial areas:
`/dashboard`, `/players`, `/jobs`, `/hustles`, `/vehicles`, `/properties`, `/business-types`, `/world-events`, `/advertising`, `/economy`, `/feature-flags`, `/audit-logs`.

Economy adjustments must create both a normal ledger transaction and immutable admin audit record.

## Health / OpenAPI
- `/health/live`
- `/health/ready`

Generate OpenAPI documentation from NestJS DTOs/controllers.

## First Playable API
```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /me
POST /characters
GET  /characters/me
GET  /wallet
GET  /wallet/transactions
GET  /jobs
POST /jobs/:id/start
GET  /jobs/active
POST /jobs/assignments/:id/complete
GET  /dashboard
```

This supports: REGISTER → CREATE CHARACTER → RECEIVE HK₦20K → START JOB → COMPLETE JOB → GET PAID → SEE LEDGER.

## Non-Negotiable Invariants
1. Client never sets balance, reward, success, authoritative price, Heat or reputation.
2. Every currency mutation creates ledger history.
3. Sensitive mutations are atomic.
4. Retryable economic mutations are idempotent.
5. Concurrent spending cannot overspend.
6. Public APIs never expose private/security/admin information.
7. Underground gameplay remains fictional and abstract.
8. Real-money withdrawal is not V1.
9. Realtime transport cannot bypass economic/domain rules.
10. Every production error is traceable with a request ID.

## Definition of Done
Each endpoint requires validation, auth/authorization, domain checks, standardized responses, transactions/idempotency/concurrency where required, tests, and OpenAPI documentation.

Economic endpoints additionally require ledger reconciliation, retry tests, rollback tests and simultaneous-request tests.

**The player requests actions. The server determines reality.**
