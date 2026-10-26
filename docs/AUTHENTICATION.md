# Phase 1 authentication implementation

This implementation note supplements the approved specifications without changing
their scope. Registration creates only an account and authenticated session.
`GET /api/v1/me` returns `{ user, character }`, where character is null until creation.

## Credentials and identity

Email and username are trimmed and lowercased without provider-specific rewriting.
Usernames contain 3–24 ASCII letters, numbers or underscores. Database checks
enforce canonical storage and unique indexes enforce identity uniqueness under races.
Passwords accept 12–128 characters without trimming or complexity requirements.
Argon2id uses 64 MiB memory, three iterations and parallelism one. Unknown identifiers
still perform password verification against a dummy hash. Public registration
cannot assign role/status; PostgreSQL defaults them to PLAYER/ACTIVE.

## Transport and public contracts

The six endpoints are `/api/v1/auth/register`, `/auth/login`, `/auth/refresh`,
`/auth/logout`, `/auth/logout-all` (all prefixed `/api/v1`) and `/api/v1/me`.
Register/login/refresh return `{ user, accessToken, expiresIn }`; logout operations
return 204. The account serializer exposes only id, email, username and role.
Error bodies retain the Phase 0 stable-code/request-ID envelope.

Access tokens use JOSE HS256 with fixed issuer/audience, a configured 10-minute
default lifetime and only sub, sid, iat, exp, iss and aud claims. Their signing key
is server-only. Guards validate JWTs and check active session/account status in
PostgreSQL on every protected request. RolesGuard requires an authenticated
principal and an explicit allowed role list; no admin routes are added.

Refresh credentials are 32 random bytes, stored only as SHA-256 digests. A host-only
HttpOnly cookie named `hk_refresh` has Path `/api/v1/auth`, SameSite=Strict and an
absolute configured expiry (seven days by default). Secure is enabled in production.
No refresh credential is returned in JSON. Access tokens stay in Pinia memory,
never localStorage or sessionStorage. Auth/account responses disable caching.

Browser auth POSTs require exact WEB_ORIGIN plus `X-HK-Client: web`, which triggers
CORS preflight across origins and prevents simple form-based login/refresh CSRF.
Requests with absent/foreign/null Origin or absent custom header are rejected.
CORS permits credentials only for the explicit configured origin. SameSite cookies
require web and API to share the same scheme/site; unrelated hosting domains are
not supported by this strategy. Keep both local URLs on 127.0.0.1.

## Rotation, concurrency and revocation

Each refresh credential gets a row in `auth_sessions`; a stable family ID identifies
one browser/device session. Rotation revokes the old row and inserts a new digest
atomically without extending absolute expiry. Spent digests remain recognizable.
Reuse revokes all active rows in that family and commits before returning 401.
The partial unique index permits at most one unrevoked row per family.

Session creation, rotation and revocation lock the same user row, making logout-all
and refresh serialize consistently. Duplicate identity inserts rely on database
constraints. Session-signing failure rolls account/session creation back together.
Logout is idempotent and revokes the cookie's family. Logout-all revokes only the
authenticated user's families. Guards check durable revocation, so access tokens
also lose protected access immediately, without a blacklist.

The client shares a refresh in flight, retries an eligible unauthorized request
once, and clears authentication after failed refresh or a rejected retry. Startup
restoration loads `/me` before protected navigation is allowed. Logout waits for
pending refresh; logout-all renews credentials first to handle idle access expiry.
Concurrent refreshes across separate tabs can still trigger conservative replay
revocation; signing in again recovers the session. No cross-tab coordinator is built.
If sign-out cannot reach the API, local state clears and UI explicitly reports
that server revocation could not be confirmed.

## Operations and testing

Redis holds atomic fixed-window counters keyed by endpoint and a digest of the
direct client IP, never durable session truth. Forwarded IP headers are not trusted.
A reverse proxy needs an explicitly reviewed trusted-proxy setup before deployment;
otherwise requests share the proxy's rate budget. Limits are configurable and a
Redis outage fails closed. Never run tests against production credentials.

JWT secrets must be supplied and at least 32 bytes; production rejects the public
development fixture and placeholder values. Passwords, tokens, headers and stored
hashes are never intentionally logged. HTTP logs include only method/status and
server request ID. Expired credential cleanup/retention is an operations follow-up;
there is no scheduled cleanup worker in Phase 1.

Vitest's Node test project uses SWC so decorator metadata matches production and
real DTO validation is exercised. Integration tests cover SQL uniqueness races,
rotation/replay races, rollback, revocation, rate limiting and safe serialization.
Playwright starts dedicated local servers and tests registration, restoration,
logout, login, protected routing and logout-all. Character tables were added in Phase 2; economy remains deferred.

## Phase 2 integration

`/me` now returns a safe character object or `null`. The current-account Pinia
store owns this object and hydrates it on sign-in and session restoration. Accounts
without characters enter `/create-character`; `/account` requires a character.
See [CHARACTERS.md](CHARACTERS.md) for the current contract. Registration itself
continues to create only an account and session.
