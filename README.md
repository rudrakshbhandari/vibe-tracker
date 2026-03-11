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
npm install
cp .env.example .env
npm run db:generate
npm run dev
```

The current `/api/metrics` endpoint serves demo data so the dashboard can be exercised before the GitHub integration is wired.

Example:

```bash
curl "http://localhost:3000/api/metrics?window=30d&mode=authored"
```

## Next implementation steps

1. Add GitHub App auth and installation flow.
2. Implement repository and branch discovery per installation.
3. Fetch commits within a requested window and persist `additions` / `deletions`.
4. Link commits to PRs for drilldown while keeping commit SHA as the counting primitive.
5. Add incremental sync jobs and user-configurable windows.
