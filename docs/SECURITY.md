# HUSTLING KINGDOM — SECURITY.md

**Version:** 1.0  
**Status:** V1 Security Specification

## 1. Objectives
Protect player accounts, personal data, administrative access, infrastructure and the integrity of the virtual economy. The browser is untrusted; the server is authoritative.

## 2. Trust Boundary
Never trust client-provided balances, rewards, prices, probabilities, ownership, Heat, reputation, inventory, cooldown completion, market settlement or role. Validate request shape and domain permission.

## 3. Authentication
Use established password hashing, short-lived access tokens, rotating/revocable refresh sessions and secure production transport/storage. Never invent custom cryptography. Rate-limit registration, login, refresh and recovery.

## 4. Authorization
Roles: `PLAYER`, `MODERATOR`, `ADMIN`, `SUPER_ADMIN`. Enforce authorization server-side and deny privileged operations by default.

## 5. Economy Security
Every currency mutation must be server-side, create immutable ledger history, use authoritative price/reward data, be atomic, be concurrency-safe, and be idempotent when retries could duplicate effects.

Gameplay modules may not bypass the Economy domain to mutate balances.

## 6. Idempotency / Replay
Persist actor, action, key, request fingerprint, status and result. Same key/same operation returns the original result; conflicting reuse fails. Idempotency does not replace constraints, locks or transactions.

## 7. Anti-Cheat
Assume users can modify JavaScript, Pinia, local storage, HTTP calls and WebSocket messages. Track abnormal action velocity, impossible progression, replay attempts and impossible movement. Keep thresholds/private scoring server-side.

## 8. Realtime
Authenticate sockets, authorize location/room joins, validate and rate-limit movement, and never allow realtime messages to assign money, rewards, ownership, Heat or reputation.

## 9. Input / Output
Use explicit DTO/schema validation and output serializers. Prevent mass assignment. Do not expose stack traces, SQL errors, internal paths, secrets, hidden probabilities or anti-cheat details. Safely render user-generated text.

## 10. Database / Secrets
Use least-privilege DB credentials, migrations, relational constraints and transactions. Never commit secrets, ship them in Vue bundles, place them in docs/screenshots or seed data. Rotate compromised secrets.

## 11. Admin Security
Admin routes require explicit authorization. High-risk actions such as balance adjustments require a reason and immutable audit record. There is no invisible balance editing.

## 12. Advertising
Approve legitimate advertisers and destinations. Reject real-world ads for fraud facilitation, stolen accounts, laundering, criminal pickers, credential theft or similar illicit services.

## 13. Fictional Crime Boundary
Underground gameplay remains abstract. Do not store/build workflows for real victim data, stolen credentials, phishing kits, payment-account access, laundering routes, real criminal contacts or operational crime/evasion instructions.

## 14. Privacy
Collect only necessary data. Public profiles expose deliberately public fields only. Never expose email, tokens/sessions, private ledger, moderation notes, security flags or private relationship state publicly.

## 15. Logging
Use structured logs and request IDs. Never log plaintext passwords, access/refresh tokens, secrets or unnecessary sensitive payloads. Economic/admin actions remain traceable.

## 16. Rate Limiting
Apply controls to authentication, recovery, hustle/job mutations, purchases, trading, ad telemetry and realtime movement. Rate limiting supplements domain validation.

## 17. Browser Security
If cookies are used, apply appropriate SameSite/CSRF defenses and Secure/HttpOnly settings. Production CORS uses explicit trusted origins. Configure appropriate browser security headers.

## 18. Dependencies / Uploads
Maintain lockfiles and security checks in CI. For avatars/ad creatives, enforce size/type limits, safe object keys and safe serving behavior; never trust extensions alone.

## 19. Backups / Recovery
Back up PostgreSQL and critical object storage and periodically test restoration. After recovery, wallet/account state must reconcile against the immutable ledger.

## 20. Required Security Tests
Test unauthorized admin denial, IDOR/ownership checks, duplicate economic requests, concurrent spending, manipulated prices/rewards, revoked sessions, public-profile privacy, rate limits, and ledger/account reconciliation.

## 21. Incident Controls
Maintain ability to revoke sessions, suspend accounts, disable features, stop selected queue processors, disable ad campaigns, inspect transactions by request ID, and audit admin adjustments.

## 22. Non-Negotiable Principle
```text
UNTRUSTED CLIENT
      ↓
VALIDATED REQUEST
      ↓
AUTHORIZED DOMAIN ACTION
      ↓
ATOMIC SERVER DECISION
      ↓
DURABLE AUDITABLE STATE
```

The client may request. It never declares reality.
