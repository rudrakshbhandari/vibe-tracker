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
- `PullRequest`: merged PR metadata and shipped-work stats.
- `DailyUserRepoStats`: aggregate shipped additions, deletions, commit counts, and merged PR counts by user, repo, and day.
- `SyncCursor`: per-repo incremental cursor so repeated syncs only fetch recently updated PRs.
- `SyncJob`: queued/running/completed sync bookkeeping.

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

## GitHub App setup

Create a GitHub App with:

- User authorization callback URL: `http://localhost:3000/api/github/callback`
- Setup URL: `http://localhost:3000/api/github/setup`
- Permissions:
  - Repository metadata: read-only
  - Contents: read-only
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

Recommended shared env file example:

```bash
mkdir -p ~/.config/vibe-tracker
cp .env.example ~/.config/vibe-tracker/.env.shared
```

The current live flow is:

1. User clicks a single GitHub CTA in the app.
2. If they already have an accessible installation, the app syncs repository grants automatically after auth.
3. If they do not, GitHub sends them to install the app, then returns to the setup URL.
4. The setup URL refreshes repository grants only, so onboarding stays fast.
5. The user can then run `Sync my activity`, which pulls merged PRs and updates daily shipped-work aggregates for the last 90 days on first sync, then incrementally from per-repo cursors afterward.

Hosted note:

- Production deploys must run `prisma generate` so the Prisma client matches the checked-in schema.
- `DATABASE_URL` should point at the runtime Postgres connection.
- `DIRECT_URL` should point at the direct Postgres connection Prisma uses for schema operations.

## Usability model

- Install/setup is lightweight and should return quickly.
- Activity sync is explicit and scoped to shipped work attributed to the signed-in user.
- Sync reads merged pull requests, not the full branch graph.
- Analytics views are exposed as `daily`, `weekly`, and `monthly`.
- The metrics API mirrors those controls through `view` and `mode`.

## Next implementation steps

1. Replace the in-process dispatch with a durable external queue.
2. Add GitHub webhook handling for merged PRs and repository access changes.
3. Add deeper PR drilldowns only if the product needs them.
4. Add explicit repository selection so large installations can opt into narrower sync scope.
