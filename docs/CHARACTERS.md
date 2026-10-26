# Phase 2 character implementation

This implementation note is subordinate to the approved specifications. User is
account identity; Character is game identity. The approved database field names
`name` and `gender` are used in REST and shared contracts.

## Persistence and starting state

The character migration adds only `characters`, `character_stats`, and their
enums/constraints. It preserves Phase 1 users and sessions and creates no characters
automatically. Apply it using `pnpm prisma:deploy`, then `pnpm prisma:generate`.
Normal development schema changes continue to use `pnpm prisma:migrate`.

`characters.user_id` is unique. Stats use the character UUID as primary/foreign
key. Creation inserts both in one transaction. Deferred SQL constraint triggers
also prohibit committing a character without stats, including through direct SQL
or accidental stat deletion. These triggers and stat CHECK bounds are maintained
in migration SQL because Prisma's model DSL does not express them. Cascade cleanup
is available for test fixtures; there is no account/character deletion endpoint.
Future economic history requires a deliberate retention policy before deletion.

Initial stats are reputation 0, Heat 0, health 100, energy 100, stress 10.
Reputation uses PostgreSQL BIGINT and a decimal string in JSON to preserve precision.
The approved `highest_net_worth` column retains its required default 0 internally;
it is neither calculated nor exposed. It is not a balance. Phase 3 owns economic
initialization and all real net-worth behavior.

Family House is a server-owned starting-residence label in the response. No
location, property or ownership records exist. The optional `current_location_id`
relationship is deferred until a real locations boundary exists; a residence
label does not imply map occupancy or property ownership.

## Input and appearance

Names accept 2–40 Unicode code points, trim outer whitespace and preserve internal
spaces. Control/format/line-separator characters are rejected, including at edges.
Names are not globally unique. Slugs are independent random UUIDs with a unique
database constraint. Gender presentations are MALE, FEMALE, NON_BINARY; the approved
specifications require an enum but do not enumerate its members. These are public
presentation choices, not inferred account attributes or gameplay modifiers.

`packages/shared/src/character.ts` holds the public appearance catalog and explicit
contracts. It contains only cosmetic IDs. All options are compatible with each
presentation. Categories are skinTone, face, hair, top, bottom, shoes. No URLs,
arbitrary CSS, prices, hidden rules or secrets are accepted. Full creation requires
all six categories. The backend validates exact keys and catalog membership before
persisting bounded JSONB; the database also checks the six-key object shape.
The simple Vue/SVG preview is temporary art, not a Phaser world or final asset library.

## API

All three endpoints require the existing Bearer guard, derive the owner from its
principal, return explicit safe JSON objects, and set `Cache-Control: no-store`.

- `POST /api/v1/characters`: `{ name, gender, appearance }`, 201 CharacterResponse.
  Requires an Idempotency-Key of 8–128 ASCII letters, digits, underscores or hyphens.
- `GET /api/v1/characters/me`: own CharacterResponse, or 404 CHARACTER_REQUIRED.
- `PATCH /api/v1/characters/me/appearance`: nonempty partial cosmetic object such
  as `{ "hair": "braids" }`; omitted categories are preserved. Returns updated
  CharacterResponse. Null, unknown keys, URLs and unavailable options are rejected.

Unexpected creation fields return VALIDATION_ERROR. Cosmetic membership/shape
errors return INVALID_APPEARANCE. Authentication retains Phase 1's UNAUTHORIZED
code. Duplicate new intent returns CHARACTER_ALREADY_EXISTS; changed payload
under the same key returns IDEMPOTENCY_CONFLICT. Errors retain the existing safe
request-ID envelope. There are no rename, stat mutation, public-profile or deletion
routes. OpenAPI describes only implemented routes.

`GET /api/v1/me` returns `{ user, character }`, with null before creation and the
same safe character shape afterward. Internal ownership, receipt fields,
highest-net-worth, session records and database models never reach the browser.

## Idempotency and concurrency

Creation and appearance edits lock the User row in PostgreSQL, the same order used
by authentication. Session/account eligibility is rechecked inside the transaction
after the lock. This serializes concurrent requests across API instances and avoids
lost updates when separate cosmetic categories are edited concurrently. Same-field
edits use last committed write. The unique owner index remains the structural
defense against duplicate characters even outside the service.

Each character stores its scoped creation key, normalized request fingerprint and
bounded original response receipt. The receipt is written in the creation transaction
and never changed by later cosmetic edits. Same-key/same-input retries return the
original 201 body, even after edits. Fingerprints use a fixed category ordering,
so JSON property ordering does not change identity. Keys are scoped to the owner
and creation only. No generic idempotency table or economy subsystem is introduced.

## Browser state

The existing current-account Pinia store owns user, access token and current
character exactly once. Sign-in and session restoration hydrate it through `/me`.
Guest protected navigation goes to login; accounts without a character go to
`/create-character` when entering `/account` or guest routes. Existing characters
go to Home (`/`) from login, register and creation. The public Home
remains accessible with an entry overlay for guests. Creation success updates memory and navigates without reload.

The single short onboarding form supplies immediate name validation, defaults from
the catalog, a prominent avatar, visual radio choices, busy/error states and a disabled submit button. An unchanged
payload keeps its in-memory key across network retries; changed intent gets a new
key. After a reload, session restoration discovers an already committed character.
`/account` opens Me over the world, with avatar, life meters and cosmetic editing.

## Verification and phase boundary

Existing CI commands discover the new backend unit/integration, frontend state/form
and mobile Playwright tests. Integration fixtures use randomized accounts and are
removed; browser fixtures remain under the existing test-account policy. Tests
cover authorization, unexpected fields, privacy, exact initial stats, SQL uniqueness,
concurrent requests, partial updates, idempotent replay, bounds and rollback.

SPECIFICATION CONFLICT (scope resolved by the explicit Phase 2 request):
`docs/API.md` describes full-V1 creation with wallet and starting-money ledger entries.
`docs/ROADMAP.md` permits deferral to Phase 3, and this task explicitly requires it.
The implementation therefore creates identity and stats only. The recommended
resolution is to implement funding and safe exactly-once initialization of existing
characters in the separately reviewed Phase 3. Approved specifications are preserved.

No wallet, cash/bank balance, ledger, starting currency, economy service, jobs,
hustles, stat progression, Phaser city or presence is implemented here.

## Phase 3 integration

The Phase 2 funding deferral is now resolved by EconomyModule. New creation calls
EconomyService inside the same transaction as identity/stats; existing characters
use the explicit rerunnable backfill. Character endpoints and original creation
receipts keep their public response shape. Economy history now prevents deletion
of funded fixtures; the Phase 2 cleanup description above is historical. See
[ECONOMY-IMPLEMENTATION.md](ECONOMY-IMPLEMENTATION.md) and [UI-UX.md](UI-UX.md).
