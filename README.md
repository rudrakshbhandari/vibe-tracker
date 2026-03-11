# Vibe Tracker

Vibe Tracker is a web MVP for aggregating GitHub code volume for a user across repositories, branches, and pull requests without double-counting the same commit across refs.

## Locked product decisions

- Product shape: web app with a backend API and background sync.
- User scope: logged-in users see repositories they authorize through GitHub.
- Metric definition: authored commits are the primary source of truth.
- Secondary lens: merged-to-default-branch is a toggle, not a separate canonical metric.
- Deduplication: commit SHA is canonical for counting work.
- Time lens: author date is the default basis for day, week, month, and custom windows.
- Sync strategy: hybrid live fetch plus cached background sync.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS v4
- Prisma with SQLite for local MVP persistence
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

## Usability model

- Install/setup is lightweight and should return quickly.
- Activity sync is explicit and scoped to the signed-in user’s authored commits.
- Analytics views are exposed as `daily`, `weekly`, and `monthly`.
- The metrics API mirrors those controls through `view` and `mode`.

## Next implementation steps

1. Add a real background queue so authored activity sync does not block the HTTP request.
2. Persist sync cursors so repeat activity syncs only fetch new commits.
3. Add webhook handling so installation changes and pushes can trigger targeted refreshes.
4. Replace the sample fallback dashboard copy once a user has connected but not yet synced activity.
