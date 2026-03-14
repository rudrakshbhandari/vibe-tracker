# Vibe Tracker

Vibe Tracker is a web MVP for aggregating GitHub code volume for a user across repositories, branches, and pull requests without double-counting the same commit across refs.

The homepage is intentionally simple:

- If GitHub is not connected, the app shows a clear disconnected state and the exact steps to connect, install, and sync.
- If GitHub is connected, the app shows real synced metrics only. It does not fall back to demo analytics for signed-out users.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS v4
- Prisma with PostgreSQL
- Route handlers for internal API endpoints

## Data model

The current schema is designed around commits as the canonical unit:

- `GitHubAccount`: GitHub users who authorize the app or appear as commit authors.
- `Installation`: GitHub App installation scope.
- `Repository`: repos granted through an installation.
- `Branch`: tracked branch refs per repository.
- `Commit`: canonical commit record with additions, deletions, author metadata, and merge state.
- `CommitBranch`: branch membership for dedupe-safe branch analytics.
- `PullRequest`: PR metadata for drilldown and filtering.
- `PullRequestCommit`: PR-to-commit link table.
- `SyncJob`: background sync bookkeeping.

## Getting started

```bash
nvm use 20.20.0
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run dev
```

Example:

```bash
curl "http://localhost:3000/api/metrics?view=weekly&mode=authored"
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

The current live flow is:

1. User clicks a single GitHub CTA in the app.
2. If they already have an accessible installation, the app syncs repository grants automatically after auth.
3. If they do not, GitHub sends them to install the app, then returns to the setup URL.
4. The setup URL refreshes repository grants only, so onboarding stays fast.
5. The user can then run `Sync my activity`, which backfills authored commits, branch membership, and associated PR metadata for the last 12 months.

Hosted note:

- Production deploys must run `prisma generate` so the Prisma client matches the checked-in schema.
- `DATABASE_URL` should point at the runtime Postgres connection.
- `DIRECT_URL` should point at the direct Postgres connection Prisma uses for schema operations.

## Usability model

- Install/setup is lightweight and should return quickly.
- Activity sync is explicit and scoped to the signed-in user’s authored commits.
- Analytics views are exposed as `daily`, `weekly`, and `monthly`.
- The metrics API mirrors those controls through `view` and `mode`.

## Next implementation steps

1. Add a real background queue so authored activity sync does not block the HTTP request.
2. Persist sync cursors so repeat activity syncs only fetch new commits.
3. Add webhook handling so installation changes and pushes can trigger targeted refreshes.
4. Add drilldowns so users can inspect which repositories and commits drove each time bucket.
