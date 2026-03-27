# Cloudflare Worker

This directory contains the new Cloudflare-first backend scaffold for Vibe Tracker.

## Implemented in this slice

- Worker entrypoint with health and maintenance routes
- D1 schema migration for the normalized app data model
- Queue message contracts for leaderboard and maintenance jobs
- D1-backed leaderboard score recomputation and rank materialization
- Scheduled maintenance hook for stale sync jobs, expired invites, and rank rebuilds

## Expected bindings

The worker code expects these bindings at deploy time:

- `DB`: D1 database binding
- `MAINTENANCE_TOKEN`: bearer token for manual maintenance endpoints

## Current endpoints

- `GET /health`
- `POST /internal/maintenance/run`
- `POST /internal/leaderboards/rebuild`

## Current scripts

- `npm run cloudflare:dev`
- `npm run cloudflare:typecheck`
- `npm run cloudflare:test`

## Next migration steps

1. Bind the Worker to real D1 and Queue resources
2. Port GitHub OAuth/session handling into the Worker runtime
3. Replace browser-polled sync with queue-driven installation and repository consumers
4. Switch the frontend to read from the Cloudflare-backed APIs
