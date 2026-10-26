# Development infrastructure

The root Compose file runs PostgreSQL 17 and Redis 7.4 on loopback ports 5432 and
6379, with health checks and named development volumes. Vue and Nest run locally.
Credentials in Compose are public development fixtures, never production secrets.

PostgreSQL is durable truth. Redis is for ephemeral state and BullMQ. The
`infrastructure` queue has no worker and receives no jobs during application startup.
Integration tests add and remove one connection-verification job.

`docker compose stop` preserves data. `docker compose down` removes containers but
keeps volumes. Deleting volumes destroys local data and is not part of normal setup.

Socket.IO has a configured Nest adapter but no public gateway or event handlers.
This deliberately leaves authentication and presence to their assigned phases.
