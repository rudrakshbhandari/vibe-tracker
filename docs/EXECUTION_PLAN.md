# Execution Plan

## Issue #18 - Simplify homepage to focus on core dashboard metrics

- Issue: [#18](https://github.com/rudrakshbhandari/vibe-tracker/issues/18)
- Branch: `codex/simplify-main-screen`
- PR: [#19](https://github.com/rudrakshbhandari/vibe-tracker/pull/19)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Shrink the homepage header so identity and controls stay visible without a giant hero
- [x] Keep the username, key stats, repo list, status cards, actions, and time filters
- [x] Make the activity chart the primary full-width section
- [x] Remove low-signal duplicate panels from the connected dashboard
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #13 - Simplify homepage to real vibe-coding dashboard and clear connect state

- Issue: [#13](https://github.com/rudrakshbhandari/vibe-tracker/issues/13)
- Branch: `codex/simple-vibe-webapp`
- PR: [#14](https://github.com/rudrakshbhandari/vibe-tracker/pull/14)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Remove the internal "Locked decisions" and other prototype-only homepage sections
- [x] Stop showing sample/demo analytics to disconnected users
- [x] Add a clear disconnected state with connect/install/sync instructions
- [x] Keep connected users focused on real synced metrics and repository breakdowns
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #1 - Make Vibe Tracker onboarding and analytics usable

- Issue: [#1](https://github.com/rudrakshbhandari/vibe-tracker/issues/1)
- Branch: `rudrakshbhandari/make-vibe-tracker-usable`
- PR: [#2](https://github.com/rudrakshbhandari/vibe-tracker/pull/2)
- Workflow: Done
- Priority: P1
- App: multi

### Checklist

- [x] Move work onto a task-specific branch instead of leaving it on an unrelated branch
- [x] Split installation metadata sync from authored activity sync so setup remains fast
- [x] Add a dedicated activity sync action for the signed-in user
- [x] Replace the old fixed-window view with explicit daily/weekly/monthly analytics modes
- [x] Keep the metrics API aligned with the new dashboard controls
- [x] Validate runtime flow against the local dev server with the new sync path
- [x] Push branch and open PR

## Issue #6 - Sync execution tracking after merged onboarding PR

- Issue: [#6](https://github.com/rudrakshbhandari/vibe-tracker/issues/6)
- Branch: `rudrakshbhandari/close-task-cleanup`
- PR: [#7](https://github.com/rudrakshbhandari/vibe-tracker/pull/7)
- Workflow: In Review
- Priority: P3
- App: multi

### Checklist

- [x] Confirm Issue #1 PR state after merge
- [x] Move the Issue #1 project item to Done
- [x] Commit the repository AGENTS instructions file
- [x] Open the cleanup PR and record its URL

## Issue #9 - Fix Prisma production generation for hosted deploys

- Issue: [#9](https://github.com/rudrakshbhandari/vibe-tracker/issues/9)
- Branch: `codex/fix-prisma-production-build`
- PR: [#10](https://github.com/rudrakshbhandari/vibe-tracker/pull/10)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Reproduce the hosted OAuth failure against production logs
- [x] Confirm the failure is a Prisma client / datasource mismatch rather than GitHub token exchange
- [x] Regenerate Prisma client during install/build so hosted deploys match the checked-in schema
- [x] Surface account persistence failures separately from GitHub `/user` failures
- [x] Update docs and agent instructions for the hosted Postgres flow
- [x] Run tests and build
- [x] Push branch and open PR

## Issue #11 - Fix activity sync refresh behavior and dashboard overflow

- Issue: [#11](https://github.com/rudrakshbhandari/vibe-tracker/issues/11)
- Branch: `codex/fix-sync-refresh-and-dashboard-layout`
- PR: [#12](https://github.com/rudrakshbhandari/vibe-tracker/pull/12)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Reproduce the repeated-click sync behavior and layout overflow against live data
- [x] Confirm duplicate syncs are possible from the current route/UI flow
- [x] Guard against overlapping activity sync runs
- [x] Auto-refresh the dashboard while sync is running
- [x] Constrain the live dashboard layout so large data sets do not collide
- [x] Run tests, lint, and build
- [x] Push branch and open PR
