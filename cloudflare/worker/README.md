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

## Expected bindings

The worker code expects these bindings at deploy time:

- `DB`: D1 database binding
- `APP_URL`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `MAINTENANCE_TOKEN`: bearer token for manual maintenance endpoints
- `SESSION_ENCRYPTION_KEY`
- `SYNC_QUEUE`: Queue producer binding used to fan out installation and repository sync work

## Current endpoints

- `GET /health`
- `GET /api/github/connect`
- `GET /api/github/callback`
- `GET /api/session/reset`
- `POST /internal/maintenance/run`
- `POST /internal/leaderboards/rebuild`

## Current scripts

- `npm run cloudflare:dev`
- `npm run cloudflare:typecheck`
- `npm run cloudflare:test`

## Next migration steps

1. Bind the Worker to real Queue resources in Wrangler
2. Port installation metadata sync and repository activity consumers into Queue handlers
3. Replace browser-polled sync with queue-driven installation and repository consumers
4. Switch the frontend to read from the Cloudflare-backed APIs
