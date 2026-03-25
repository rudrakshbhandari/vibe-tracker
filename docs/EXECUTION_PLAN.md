# Execution Plan

## Issue #80 - Patch dependency security updates after UI audit

- Issue: [#80](https://github.com/rudrakshbhandari/vibe-tracker/issues/80)
- Branch: `rudrakshbhandari/patch-security`
- PR: Pending
- Workflow: In Progress
- Priority: P1
- App: multi

### Checklist

- [x] Patch dependencies to a clean `npm audit`
- [x] Re-run lint, tests, and build under Node 20
- [x] Investigate a full authenticated audit path after the UI review
- [ ] Push branch and open PR

## Issue #78 - Fix theme hydration and social landing layout

- Issue: [#78](https://github.com/rudrakshbhandari/vibe-tracker/issues/78)
- Branch: `rudrakshbhandari/ui-audit`
- PR: [#79](https://github.com/rudrakshbhandari/vibe-tracker/pull/79)
- Workflow: Done
- Priority: P1
- App: multi

### Checklist

- [x] Reproduce the first-load theme toggle hydration mismatch in the browser
- [x] Make the theme toggle render deterministically across server and client
- [x] Improve the signed-out social landing layout for desktop while preserving mobile behavior
- [x] Run lint, tests, build, audit, and browser verification
- [x] Push branch and open PR

## Issue #76 - Default shipped-work dashboard to daily view

- Issue: [#76](https://github.com/rudrakshbhandari/vibe-tracker/issues/76)
- Branch: `rudrakshbhandari/default-daily-view`
- PR: [#77](https://github.com/rudrakshbhandari/vibe-tracker/pull/77)
- Workflow: In Review
- Priority: P2
- App: multi

### Checklist

- [x] Identify the server and fallback defaults that still land on weekly
- [x] Change the page, metrics schema, and dashboard fallback defaults to `daily`
- [x] Run tests
- [x] Push branch and open PR

## Issue #74 - Update GitHub Actions workflows for Node 24 compatibility

- Issue: [#74](https://github.com/rudrakshbhandari/vibe-tracker/issues/74)
- Branch: `rudrakshbhandari/update-actions-node24`
- PR: [#75](https://github.com/rudrakshbhandari/vibe-tracker/pull/75)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Identify the workflow actions still pinned to deprecated Node 20 runtimes
- [x] Upgrade CI and hosted-smoke workflow actions to Node 24 compatible versions
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #72 - Fix pull request branch-field sync regressions

- Issue: [#72](https://github.com/rudrakshbhandari/vibe-tracker/issues/72)
- Branch: `rudrakshbhandari/fix-sync-branch-fields`
- PR: [#73](https://github.com/rudrakshbhandari/vibe-tracker/pull/73)
- Workflow: In Review
- Priority: P0
- App: multi

### Checklist

- [x] Reproduce the hosted smoke failure from the new main-branch workflow run
- [x] Restore required branch-field persistence in the Prisma model and both sync write paths
- [x] Add regression coverage for required pull request branch fields
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #70 - Set up sandbox GitHub sync smoke testing and deploy gate

- Issue: [#70](https://github.com/rudrakshbhandari/vibe-tracker/issues/70)
- Branch: `rudrakshbhandari/setup-sync-smoke-gate`
- PR: [#71](https://github.com/rudrakshbhandari/vibe-tracker/pull/71)
- Workflow: Done
- Priority: P0
- App: multi

### Checklist

- [x] Define a hosted smoke-test path that validates real GitHub sync behavior without personal-account sharing
- [x] Add a protected smoke endpoint and CLI smoke runner for hosted deploy verification
- [x] Add a post-deploy GitHub Action that waits for Vercel and runs the hosted smoke check
- [x] Configure the shared smoke secret in Vercel and GitHub Actions
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #68 - Fix production activity sync null title failure

- Issue: [#68](https://github.com/rudrakshbhandari/vibe-tracker/issues/68)
- Branch: `rudrakshbhandari/fix-activity-sync-title`
- PR: [#69](https://github.com/rudrakshbhandari/vibe-tracker/pull/69)
- Workflow: In Review
- Priority: P0
- App: multi

### Checklist

- [x] Reproduce the live production sync failure from Vercel logs
- [x] Restore `PullRequest.title` to the Prisma model and activity sync writes
- [x] Add regression coverage for syncing pull request titles
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #65 - Fix production GitHub connection missing-config regression

- Issue: [#65](https://github.com/rudrakshbhandari/vibe-tracker/issues/65)
- Branch: `rudrakshbhandari/fix-production-github-connection`
- PR: [#66](https://github.com/rudrakshbhandari/vibe-tracker/pull/66)
- Workflow: In Review
- Priority: P0
- App: multi

### Checklist

- [x] Reproduce the live `/?github=missing-config` regression from the production GitHub connect route
- [x] Restore hosted database env detection for Vercel-style Postgres aliases
- [x] Add regression coverage for the connect route and env helpers
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #63 - Revert PR 60 landing page rollout

- Issue: [#63](https://github.com/rudrakshbhandari/vibe-tracker/issues/63)
- Branch: `rudrakshbhandari/revert-pr-60`
- PR: [#64](https://github.com/rudrakshbhandari/vibe-tracker/pull/64)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create issue and move the rollback onto a matching branch
- [x] Restore the files changed by PR 60 to their pre-merge state
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #61 - Revert landing page dark theme regression

- Issue: [#61](https://github.com/rudrakshbhandari/vibe-tracker/issues/61)
- Branch: `rudrakshbhandari/revert-landing-theme`
- PR: [#62](https://github.com/rudrakshbhandari/vibe-tracker/pull/62)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create issue and move the fix onto a matching branch
- [x] Remove the landing-page theme toggle and restore the launch palette on the homepage
- [x] Verify the homepage still looks correct with GitHub status messaging and a stored dark preference
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #55 - Public launch privacy readiness

- Issue: [#55](https://github.com/rudrakshbhandari/vibe-tracker/issues/55)
- Branch: `rudrakshbhandari/public-launch-privacy-readiness`
- PR: [#56](https://github.com/rudrakshbhandari/vibe-tracker/pull/56)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create issue and project tracking for launch privacy work
- [x] Remove unnecessary repo-content access from the documented GitHub App scope
- [x] Minimize stored PR/session data to the fields the dashboard actually needs
- [x] Add an in-product privacy breakdown before GitHub connection
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #57 - Fix mixed light/dark theme styling on initial page load

- Issue: [#57](https://github.com/rudrakshbhandari/vibe-tracker/issues/57)
- Branch: `rudrakshbhandari/fix-theme-first-load-flash`
- PR: [#58](https://github.com/rudrakshbhandari/vibe-tracker/pull/58)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create issue and move the fix onto a matching task branch
- [x] Align the pre-hydration dark fallback with the explicit dark theme selectors
- [x] Make `color-scheme` follow the active theme to avoid mixed browser/UI treatment on first paint
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #43 - Fix production activity sync population

- Issue: [#43](https://github.com/rudrakshbhandari/vibe-tracker/issues/43)
- Branch: `rudrakshbhandari/fix-activity-sync-population`
- PR: [#44](https://github.com/rudrakshbhandari/vibe-tracker/pull/44)
- Workflow: Done
- Priority: P0
- App: multi

### Checklist

- [x] Diagnose the live sync path against production data
- [x] Replace the unreliable background `after(...)` sync trigger with a request-scoped sync
- [x] Recover automatically from stale `running` sync jobs
- [x] Re-run production sync and verify `DailyUserRepoStats` is populated
- [x] Run tests, lint, and build
- [x] Push branch and open PR

## Issue #26 - Refine dashboard spacing, typography, and chart hover details

- Issue: [#26](https://github.com/rudrakshbhandari/vibe-tracker/issues/26)
- Branch: `rudrakshbhandari/fix-dashboard-typography-tooltips`
- PR: [#27](https://github.com/rudrakshbhandari/vibe-tracker/pull/27)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create issue and move the task onto a matching branch
- [x] Tighten dashboard spacing and rebalance typography hierarchy
- [x] Make chart bars hoverable with x/y value tooltips
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #41 - Fix leftover globals.css merge markers blocking production deploy

- Issue: [#41](https://github.com/rudrakshbhandari/vibe-tracker/issues/41)
- Branch: `rudrakshbhandari/fix-globals-css-merge-markers`
- PR: Pending
- Workflow: In Progress
- Priority: P1
- App: multi

### Checklist

- [x] Restore a clean globals.css without merge markers
- [x] Run lint, tests, and build
- [ ] Push branch and open PR

## Issue #37 - Fix GitHub auth recovery UI when production session/account setup fails

- Issue: [#37](https://github.com/rudrakshbhandari/vibe-tracker/issues/37)
- Branch: `rudrakshbhandari/fix-auth-recovery-cta`
- PR: [#39](https://github.com/rudrakshbhandari/vibe-tracker/pull/39)
- Workflow: In Review

- Priority: P1
- App: multi

### Checklist

- [x] Keep a visible reconnect CTA when GitHub session lookup fails
- [x] Add a session reset route for broken cookies
- [x] Improve account setup failure copy for production recovery
- [x] Run tests, lint, and build
- [x] Push branch and open PR

## Issue #38 - Audit and sync repository docs with current GitHub state

- Issue: [#38](https://github.com/rudrakshbhandari/vibe-tracker/issues/38)
- Branch: `rudrakshbhandari/sync-project-docs`
- PR: [#40](https://github.com/rudrakshbhandari/vibe-tracker/pull/40)
- Workflow: In Review
- Priority: P2
- App: multi

### Checklist

- [x] Create issue and project tracking for the docs audit
- [x] Review the current README, scripts, and product flow for drift
- [x] Update stale execution-plan issue and PR state
- [x] Run relevant checks after docs updates
- [x] Push branch and open PR

## Issue #34 - Set up open-source contribution system before launch

- Issue: [#34](https://github.com/rudrakshbhandari/vibe-tracker/issues/34)
- Branch: `rudrakshbhandari/open-source-contribution-system`
- PR: [#35](https://github.com/rudrakshbhandari/vibe-tracker/pull/35)

- Workflow: Done
- Priority: P1
- App: multi

### Checklist

- [x] Create issue and project tracking for the contribution system work
- [x] Create a task-specific branch before editing files
- [x] Add public contribution guidance and a code of conduct
- [x] Add issue and pull request templates
- [x] Add GitHub Actions CI for pull requests and pushes to main
- [x] Update README with contribution entry points
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #32 - Refactor sync architecture around shipped work aggregates

- Issue: [#32](https://github.com/rudrakshbhandari/vibe-tracker/issues/32)
- Branch: `rudrakshbhandari/shipped-work-architecture`
- PR: [#33](https://github.com/rudrakshbhandari/vibe-tracker/pull/33)

- Workflow: Done
- Priority: P1
- App: multi

### Checklist

- [x] Replace branch and commit crawling with merged pull request sync
- [x] Add sync cursors and daily shipped-work aggregate storage
- [x] Rewrite live dashboard reads around aggregate tables
- [x] Update UI and docs to describe shipped-work semantics
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #30 - Harden worktree bootstrap and shared local dev setup

- Issue: [#30](https://github.com/rudrakshbhandari/vibe-tracker/issues/30)
- Branch: `rudrakshbhandari/worktree-bootstrap`
- PR: [#31](https://github.com/rudrakshbhandari/vibe-tracker/pull/31)

- Workflow: Done
- Priority: P1
- App: multi

### Checklist

- [x] Fix local database defaults so the example env matches the Prisma Postgres datasource
- [x] Add shared env and worktree bootstrap scripts for repeatable setup
- [x] Add a shared local Postgres compose service for worktree-safe local database access
- [x] Document the worktree/bootstrap flow in README and docs
- [x] Run lint, tests, build, and bootstrap verification
- [x] Push branch, open PR, and sync project fields/docs

## Issue #28 - Add social profiles, friends, and leaderboards

- Issue: [#28](https://github.com/rudrakshbhandari/vibe-tracker/issues/28)
- Branch: `rudrakshbhandari/social-leaderboards`
- PR: [#29](https://github.com/rudrakshbhandari/vibe-tracker/pull/29)

- Workflow: Done
- Priority: P1
- App: multi

### Checklist

- [x] Extend the Prisma schema for social visibility, friend links, invite tokens, and leaderboard snapshots
- [x] Add social APIs for me, profile settings, friends, invites, and leaderboard queries
- [x] Add a `/social` product surface plus public profile and invite pages
- [x] Refresh global leaderboard snapshots after activity sync completes
- [x] Add score/helper tests and API route coverage for the new social surface
- [x] Run lint, tests, and build
- [x] Open PR and sync the project fields/docs with the PR URL
## Issue #24 - Refine dashboard layout, remove redundant setup UI, and switch to elegant light theme

- Issue: [#24](https://github.com/rudrakshbhandari/vibe-tracker/issues/24)
- Branch: `rudrakshbhandari/light-elegant-dashboard`
- PR: [#25](https://github.com/rudrakshbhandari/vibe-tracker/pull/25)

- Workflow: Done
- Priority: P1
- App: multi

### Checklist

- [x] Replace the dark, edgy theme with a light and more elegant visual system
- [x] Remove low-signal setup actions and repeated account/installations panels
- [x] Replace the line chart with a bar chart and improve typography/spacing
- [x] Stop filter changes from scrolling the page upward during refresh
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #22 - Elevate homepage UI and reduce visual congestion

- Issue: [#22](https://github.com/rudrakshbhandari/vibe-tracker/issues/22)
- Branch: `rudrakshbhandari/elegant-homepage-refresh`
- PR: [#23](https://github.com/rudrakshbhandari/vibe-tracker/pull/23)
- Workflow: Done
- Priority: P1
- App: multi

### Checklist

- [x] Capture the current homepage in Playwright at desktop and mobile sizes
- [x] Identify the main congestion problems and visual hierarchy issues
- [x] Redesign the homepage structure for a cleaner disconnected and connected experience
- [x] Run lint, tests, build, and a final Playwright verification pass
- [x] Push branch and open PR

## Issue #20 - Fix unreadable activity chart and align monthly buckets

- Issue: [#20](https://github.com/rudrakshbhandari/vibe-tracker/issues/20)
- Branch: `codex/fix-chart-readability`
- PR: [#21](https://github.com/rudrakshbhandari/vibe-tracker/pull/21)
- Workflow: Done
- Priority: P1
- App: multi

### Checklist

- [x] Replace the unreadable timeline bars with a readable plotted chart
- [x] Keep additions and deletions visible with labels and explicit scaling
- [x] Align monthly analytics buckets to real calendar month boundaries
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #18 - Simplify homepage to focus on core dashboard metrics

- Issue: [#18](https://github.com/rudrakshbhandari/vibe-tracker/issues/18)
- Branch: `codex/simplify-main-screen`
- PR: [#19](https://github.com/rudrakshbhandari/vibe-tracker/pull/19)
- Workflow: Done
- Priority: P1
- App: multi

### Checklist

- [x] Shrink the homepage header so identity and controls stay visible without a giant hero
- [x] Keep the username, key stats, repo list, status cards, actions, and time filters
- [x] Make the activity chart the primary full-width section
- [x] Remove low-signal duplicate panels from the connected dashboard
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #16 - Improve dashboard UI hierarchy and visual polish

- Issue: [#16](https://github.com/rudrakshbhandari/vibe-tracker/issues/16)
- Branch: `rudrakshbhandari/improve-ui`
- PR: [#17](https://github.com/rudrakshbhandari/vibe-tracker/pull/17)
- Workflow: Done
- Priority: P1
- App: multi

### Checklist

- [x] Create issue and project tracking for the UI refresh
- [x] Pull the latest `main` before starting work
- [x] Rebuild the homepage hierarchy so the hero, dashboard, and sidebar panels feel distinct
- [x] Improve the visual system with stronger typography, color, and card treatments
- [x] Preserve current GitHub connection, sync, and metrics actions
- [x] Run lint, tests, and build
- [x] Push branch and open PR

## Issue #13 - Simplify homepage to real vibe-coding dashboard and clear connect state

- Issue: [#13](https://github.com/rudrakshbhandari/vibe-tracker/issues/13)
- Branch: `codex/simple-vibe-webapp`
- PR: [#14](https://github.com/rudrakshbhandari/vibe-tracker/pull/14)
- Workflow: Done
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
- Workflow: Done
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
- Workflow: Done
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
- Workflow: Done
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
