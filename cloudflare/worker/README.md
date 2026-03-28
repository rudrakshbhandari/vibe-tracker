# Cloudflare Worker

This directory contains the new Cloudflare-first backend scaffold for Vibe Tracker.

## Implemented in this slice

- Worker entrypoint with health and maintenance routes
- D1 schema migration for the normalized app data model
- Queue message contracts for leaderboard and maintenance jobs
- D1-backed leaderboard score recomputation and rank materialization
- Scheduled maintenance hook for stale sync jobs, expired invites, and rank rebuilds
- Worker-native GitHub OAuth connect/callback handlers
- Server-side D1 session storage plus cookie reset handling
- GitHub App-backed installation metadata sync and repository activity queue consumers
- Worker-backed dashboard and social read endpoints with internal trusted-header auth

## Expected bindings

The worker code expects these bindings at deploy time:

- `DB`: D1 database binding
- `APP_URL`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `INTERNAL_API_TOKEN`: shared secret used by the Next app to proxy trusted read requests
- `MAINTENANCE_TOKEN`: bearer token for manual maintenance endpoints
- `SESSION_ENCRYPTION_KEY`
- `SYNC_QUEUE`: Queue producer binding used to fan out installation and repository sync work

## Current endpoints

- `GET /health`
- `GET /api/metrics`
- `GET /api/github/connect`
- `GET /api/github/callback`
- `GET /api/session/reset`
- `GET /api/social/me`
- `GET /api/social/friends`
- `GET /api/social/leaderboard`
- `GET /api/social/profile/:login`
- `POST /internal/maintenance/run`
- `POST /internal/leaderboards/rebuild`

## Current scripts

- `npm run cloudflare:dev`
- `npm run cloudflare:typecheck`
- `npm run cloudflare:test`

## Next migration steps

1. Bind the Worker to real Queue and D1 resources in Wrangler
2. Move the remaining social/profile write paths off the old Prisma backend
3. Cut the GitHub auth/session flow over to the Worker so browser traffic no longer depends on the legacy session store
4. Retire the old Prisma/Postgres read path once the worker-backed surface is stable
