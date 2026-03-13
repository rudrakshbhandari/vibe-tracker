# Worktree Bootstrap

Use the committed scripts. Do not hand-create worktrees and then manually patch them into shape.

## One-time machine setup

1. Install Node 20.20.0 and `direnv`
2. Create a shared env file:

   ```bash
   mkdir -p ~/.config/vibe-tracker
   cp .env.example ~/.config/vibe-tracker/.env.shared
   ```

3. Fill `~/.config/vibe-tracker/.env.shared` with:
   - `APP_URL`
   - `DATABASE_URL`
   - `DIRECT_URL`
   - GitHub app credentials

4. Allow `direnv` in the repo:

   ```bash
   direnv allow
   ```

5. Start the shared local Postgres service:

   ```bash
   npm run db:up
   ```

## Create a new task worktree

```bash
./scripts/new-worktree.sh rudrakshbhandari/<task-name>
```

The script will:

- fetch `origin/main`
- create a task branch directly from `origin/main`
- create a sibling worktree directory
- link the shared env file if it exists
- run the bootstrap script in the new worktree

## Bootstrap an existing worktree

```bash
npm run bootstrap
```

The bootstrap script:

- links `.env` to the shared env file when available
- creates a local `.env` from `.env.example` when no shared env file exists yet
- installs npm dependencies
- generates the Prisma client
- runs `prisma db push` when both database URLs are present

## Local defaults

The committed local defaults assume Docker-backed Postgres on `127.0.0.1:54329`:

- database: `vibe_tracker`
- user: `postgres`
- password: `postgres`

That keeps every worktree pointed at the same local database without copying env files into each directory.
