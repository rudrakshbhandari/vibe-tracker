# Vibe Tracker

Vibe Tracker is a web MVP for aggregating shipped GitHub work for a user across repositories and time windows. The product now treats merged pull requests as the primary source of truth instead of crawling every branch and commit ref.

The homepage is intentionally simple:

- If GitHub is not connected, the app shows a clear disconnected state and the exact steps to connect, install, and sync.
- If GitHub is connected, the app shows real synced metrics only. It does not fall back to demo analytics for signed-out users.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS v4
- Prisma with PostgreSQL
- Route handlers for internal API endpoints

## Data model

The current schema is designed around shipped work and aggregate reads:

- `GitHubAccount`: GitHub users who authorize the app or appear as merged PR authors.
- `Installation`: GitHub App installation scope.
- `Repository`: repos granted through an installation.
- `PullRequest`: merged PR counters and shipped-work stats.
- `DailyUserRepoStats`: aggregate shipped additions, deletions, commit counts, and merged PR counts by user, repo, and day.
- `SyncCursor`: per-repo incremental cursor so repeated syncs only fetch recently updated PRs.
- `SyncJob`: durable queued/running/completed sync jobs with retry/lease bookkeeping and result payloads.

## Getting started

```bash
nvm use 20.20.0
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run dev
```

## Recommended local setup

The repo now supports a shared worktree-friendly setup:

1. Put your real local secrets in `~/.config/vibe-tracker/.env.shared`
2. Allow [`direnv`](https://direnv.net/) in the repo so every worktree loads the same env automatically
3. Start the shared Postgres dev database with `npm run db:up`
4. Run `npm run bootstrap` inside any worktree

The bootstrap script will:

- symlink `.env` to the shared env file when available
- install dependencies
- generate the Prisma client
- run `prisma db push` when `DATABASE_URL` and `DIRECT_URL` are available

For a clean new worktree, use:

```bash
./scripts/new-worktree.sh rudrakshbhandari/<task-name>
```

Detailed instructions live in [`docs/WORKTREES.md`](docs/WORKTREES.md).

Example:

```bash
curl "http://localhost:3000/api/metrics?view=weekly&mode=shipped"
```

## Contributing

External contributions are welcome, but the repo uses a controlled pre-launch workflow:

- Bugs, docs fixes, tests, and focused polish PRs are welcome
- Feature work should start with an issue or discussion before code is written
- All PRs should stay small, pass CI, and link the issue they close

Start here:

- [Contribution guide](.github/CONTRIBUTING.md)
- [Code of conduct](.github/CODE_OF_CONDUCT.md)

The repo runs a PR validation workflow for `lint`, `test`, and `build`.

## GitHub App setup

Create a GitHub App with:

- User authorization callback URL: `http://localhost:3000/api/github/callback`
- Setup URL: `http://localhost:3000/api/github/setup`
- Permissions:
  - Repository metadata: read-only
  - Pull requests: read-only
- Where can this GitHub App be installed: any account you want to analyze

Then fill in:

- `APP_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_APP_SLUG`
- `SESSION_ENCRYPTION_KEY`

Recommended shared env file example:

```bash
mkdir -p ~/.config/vibe-tracker
cp .env.example ~/.config/vibe-tracker/.env.shared
```

Generate a launch-safe session encryption key with:

```bash
openssl rand -base64 32
```

The current live flow is:

1. User clicks a single GitHub CTA in the app.
2. If they already have an accessible installation, the app syncs repository grants automatically after auth.
3. If they do not, GitHub sends them to install the app, then returns to the setup URL.
4. The setup URL refreshes repository grants only, so onboarding stays fast.
5. The user can then queue `Sync my activity`, which creates durable sync jobs per installation instead of doing the full GitHub fanout inside the click request.
6. The app processes queued work one job at a time, leases jobs safely, and resumes deferred work after GitHub rate-limit windows.
7. Each installation is capped to 25 tracked repositories, and users can choose which repositories stay in sync.
8. Activity sync updates daily shipped-work aggregates incrementally from per-repo cursors. Global leaderboard refreshes are queued separately instead of recomputing inline on every activity sync.

Hosted note:

- Production deploys must run `prisma generate` so the Prisma client matches the checked-in schema.
- `DATABASE_URL` should point at the runtime Postgres connection.
- `DIRECT_URL` should point at the direct Postgres connection Prisma uses for schema operations.
- Vercel Postgres aliases are also supported at runtime: `POSTGRES_PRISMA_URL` or `POSTGRES_URL` for `DATABASE_URL`, plus `POSTGRES_URL_NON_POOLING` for `DIRECT_URL`.
- Production Vercel builds now fail fast if the hosted GitHub sync env contract is incomplete, instead of shipping a broken `missing-config` state.

## Hosted smoke test

The repo now supports a protected hosted smoke check for GitHub sync at `/api/smoke/github-sync`.

- It requires `SMOKE_TEST_SECRET` in the hosted environment and the same value in the GitHub Actions secret `VIBE_TRACKER_SMOKE_TEST_SECRET`.
- By default the smoke route uses the latest previously synced merged pull request already stored in the database, so it can validate the real GitHub App + Prisma write path without a browser login.
- Optional overrides are available if you want a dedicated sandbox target later:
  - `SMOKE_TEST_INSTALLATION_ID`
  - `SMOKE_TEST_REPO_OWNER`
  - `SMOKE_TEST_REPO_NAME`
  - `SMOKE_TEST_PR_NUMBER`

The `Hosted Smoke` GitHub Action waits for the Vercel production deploy on `main`, then hits the smoke route against `https://vibe-tracker-max.vercel.app`.

## Usability model

- Install/setup is lightweight and should return quickly.
- Activity sync is explicit and scoped to shipped work attributed to the signed-in user.
- Sync reads merged pull requests, not the full branch graph.
- Analytics views are exposed as `daily`, `weekly`, and `monthly`.
- The metrics API mirrors those controls through `view` and `mode`.

## Privacy model

- The app reads GitHub identity, installation scope, repository metadata, and merged pull request stats required for shipped-work metrics.
- The app stores encrypted GitHub session tokens server-side so OAuth sessions can be refreshed safely.
- The app stores repository scope plus merged pull request counters and daily shipped-work aggregates.
- The app does not clone repositories or ingest source files for the current dashboard.

## Next implementation steps

1. Move queue processing from browser-driven polling onto a dedicated worker or cron trigger for fully unattended public scale.
2. Add GitHub webhook handling for merged PRs and repository access changes.
3. Add deeper PR drilldowns only if the product needs them.
4. Add richer operational dashboards and alerts around queue lag, rate-limit deferrals, and sync failures.
