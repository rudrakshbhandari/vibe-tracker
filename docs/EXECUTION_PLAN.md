# Execution Plan

## Issue #141 - Add localhost GitHub auth fallback for local verification

- Issue: [#141](https://github.com/rudrakshbhandari/vibe-tracker/issues/141)
- Branch: `rudrakshbhandari/fix-local-github-auth`
- PR: [#142](https://github.com/rudrakshbhandari/vibe-tracker/pull/142)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Reproduce the localhost auth redirect problem and confirm production callback leakage
- [x] Add localhost-only auth route fallbacks in Next for connect, callback, install, setup, and session reset
- [x] Normalize local `.env` and local Postgres setup so auth routes can run in dev
- [x] Verify localhost `/api/github/connect` redirects to GitHub with `http://localhost:3000/api/github/callback`
- [x] Run local verification (`npm run lint`, `npm test`, `npm run build`)
- [x] Open PR and update project tracking

### Verification

- `npm run lint`
- `npm test`
- `npm run build`
- `curl -s http://localhost:3000/api/github/connect -D - -o /dev/null`
- Playwright `page.goto('http://localhost:3000/api/github/connect')` reached GitHub sign-in with the localhost callback encoded in the return URL

## Issue #138 - Refine shipped-work chart UI and scale readability

- Issue: [#138](https://github.com/rudrakshbhandari/vibe-tracker/issues/138)
- Branch: `rudrakshbhandari/chart-ui-audit`
- PR: [#139](https://github.com/rudrakshbhandari/vibe-tracker/pull/139)
- Workflow: In Review
- Priority: P2
- App: multi

### Checklist

- [x] Audit the shipped-work chart for semantic and readability problems
- [x] Move deletions below the baseline so chart direction matches the KPI language
- [x] Add overflow-aware scaling so one outlier period does not flatten the rest of the chart
- [x] Rework chart framing copy and summary cards to explain the visible range
- [x] Run local verification (`npm run lint`, `npm test`, `npm run build`)
- [x] Open PR and update project tracking to In Review

### Verification

- `npm run lint`
- `npm test`
- `npm run build`

## Issue #136 - Fix worker internal auth lookup across Vercel and D1 stores

- Issue: [#136](https://github.com/rudrakshbhandari/vibe-tracker/issues/136)
- Branch: `rudrakshbhandari/fix-worker-internal-github-user-lookup`
- PR: pending
- Workflow: In Progress
- Priority: P0
- App: multi

### Checklist

- [x] Create the follow-up issue and task branch
- [ ] Add trusted worker lookup by GitHub user id instead of cross-store account id
- [ ] Update the live smoke route to use GitHub user id
- [ ] Add regression coverage for the trusted lookup and smoke path
- [ ] Redeploy and rerun the production smoke route

### Verification

- Pending

## Issue #134 - Add live GitHub sync safeguards and smoke coverage

- Issue: [#134](https://github.com/rudrakshbhandari/vibe-tracker/issues/134)
- Branch: `rudrakshbhandari/add-live-github-sync-safeguards`
- PR: [#135](https://github.com/rudrakshbhandari/vibe-tracker/pull/135)
- Workflow: In Review
- Priority: P0
- App: multi

### Checklist

- [x] Create the follow-up issue and task branch
- [x] Add structured worker-read failure logging
- [x] Extend the protected smoke route to validate live GitHub state and metrics by login
- [x] Add regression coverage and verify locally
- [x] Push branch, open PR, and run the live smoke check

### Verification

- `npm test -- src/lib/cloudflare-read.test.ts src/app/api/smoke/github-sync/route.test.ts`
- `npm run build`

## Issue #132 - Authenticated users see anonymous view due to empty DATABASE_URL

- Issue: [#132](https://github.com/rudrakshbhandari/vibe-tracker/issues/132)
- Branch: `rudrakshbhandari/remove-prisma-session-from-ssr`
- PR: [#133](https://github.com/rudrakshbhandari/vibe-tracker/pull/133)
- Workflow: In Review
- Priority: P0
- App: multi

### Checklist

- [x] Diagnose empty DATABASE_URL on Vercel production
- [x] Remove Prisma session lookup from SSR pages (page.tsx, social/page.tsx)
- [x] All tests pass (50/50)
- [ ] Merge and verify authenticated view restores with "Use recommended 25" button

## Issue #130 - Homepage crashes with 500 for authenticated users

- Issue: [#130](https://github.com/rudrakshbhandari/vibe-tracker/issues/130)
- Branch: `rudrakshbhandari/fix-session-crash-on-homepage`
- PR: [#131](https://github.com/rudrakshbhandari/vibe-tracker/pull/131)
- Workflow: In Review
- Priority: P0
- App: multi

### Checklist

- [x] Diagnose 500 error on production for authenticated users
- [x] Wrap getOptionalUserSession() in try/catch on homepage and social page
- [x] All tests pass (50/50)
- [ ] Merge PR and verify production recovery

### Verification

- `curl -s -H 'Cookie: vibe_tracker_session=any-value' https://vibe-tracker-max.vercel.app/ -o /dev/null -w "%{http_code}"` returned 500 before fix

## Issue #128 - Fix production GitHub sync state and SSR metrics loading

- Issue: [#128](https://github.com/rudrakshbhandari/vibe-tracker/issues/128)
- Branch: `rudrakshbhandari/fix-live-github-sync-state`
- PR: pending
- Workflow: In Progress
- Priority: P0
- App: multi

### Checklist

- [x] Create the follow-up issue and task branch
- [ ] Route SSR Cloudflare reads through the Vercel-side session account id
- [ ] Add regression coverage for internal account-id worker reads
- [ ] Redeploy production and verify connected GitHub state plus dashboard charts

### Verification

- Pending

## Issue #126 - Fix post-connect GitHub state fallback on production dashboard

- Issue: [#126](https://github.com/rudrakshbhandari/vibe-tracker/issues/126)
- Branch: `rudrakshbhandari/fix-recommended-scope-button`
- PR: pending
- Workflow: In Progress

## Issue #124 - Fix production homepage crash when recommended repo ids are missing

- Issue: [#124](https://github.com/rudrakshbhandari/vibe-tracker/issues/124)
- Branch: `rudrakshbhandari/fix-live-homepage-crash`
- PR: [#125](https://github.com/rudrakshbhandari/vibe-tracker/pull/125)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create the follow-up issue and task branch
- [ ] Add the missing Next proxy route for `/api/github/state`
- [ ] Harden worker GitHub state reads so backend lookup failures degrade safely
- [ ] Run verification, push branch, open PR, and redeploy production

### Verification

- Pending

## Issue #121 - Harden client browser API reads to avoid global error boundary

- Issue: [#121](https://github.com/rudrakshbhandari/vibe-tracker/issues/121)
- Branch: `rudrakshbhandari/fix-browser-api-error-boundary`
- PR: [#122](https://github.com/rudrakshbhandari/vibe-tracker/pull/122)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create the follow-up issue, task branch, and project tracking entry
- [x] Harden client-only browser API reads so storage/cookie/timezone failures cannot trip the global error boundary
- [x] Add regression coverage for guarded browser API paths
- [x] Run verification, push branch, and open PR

### Verification

- `npm test`
- `npm run build`
- PR: [#122](https://github.com/rudrakshbhandari/vibe-tracker/pull/122)

## Issue #119 - Add recommended repo scope and one-click apply flow

- Issue: [#119](https://github.com/rudrakshbhandari/vibe-tracker/issues/119)
- Branch: `rudrakshbhandari/recommended-repos`
- PR: [#120](https://github.com/rudrakshbhandari/vibe-tracker/pull/120)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create the follow-up issue and task branch
- [x] Add a worker-side recommended repository set per installation
- [x] Add a dedicated action to apply the recommended 25 without changing refresh behavior
- [x] Surface the recommended scope in the dashboard UI
- [x] Add coverage for the worker recommendation logic and proxy route
- [x] Run verification locally
- [x] Push branch and open PR

### Verification

- `npm run cloudflare:typecheck`
- `npm run cloudflare:test`
- `npm test`
- `npm run build`

## Issue #117 - Improve default tracked repo selection to recent personal activity

- Issue: [#117](https://github.com/rudrakshbhandari/vibe-tracker/issues/117)
- Branch: `rudrakshbhandari/recent-repo-selection`
- PR: [#118](https://github.com/rudrakshbhandari/vibe-tracker/pull/118)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create the follow-up issue and task branch
- [x] Replace alphabetical auto-selection with recent personal merged-PR ranking
- [x] Add repo recency fallback for repos without personal activity
- [x] Add worker coverage for the ranking behavior
- [x] Run verification, push branch, and open PR

### Verification

- `npm run cloudflare:typecheck`
- `npm run cloudflare:test -- sync.test.ts`

## Issue #115 - Debug production installation discovery after GitHub App install

- Issue: [#115](https://github.com/rudrakshbhandari/vibe-tracker/issues/115)
- Branch: `rudrakshbhandari/debug-installation-discovery`
- PR: [#116](https://github.com/rudrakshbhandari/vibe-tracker/pull/116)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create the follow-up issue and task branch
- [x] Trace the production worker install discovery path and confirm the missing D1 installation rows
- [x] Fix `/api/github/install` so existing signed-in installations enqueue sync instead of bouncing back to GitHub
- [x] Add worker coverage for the existing-installation install flow
- [x] Run worker verification locally
- [x] Push branch, open PR, deploy, and confirm production installation discovery and first sync

### Verification

- `npm run cloudflare:test -- routes-control-install.test.ts`
- `npm run cloudflare:test`
- `npm run cloudflare:typecheck`
- `npx wrangler deploy --config cloudflare/worker/wrangler.jsonc`
- Production smoke:
  - `/api/github/install` redirects back to the app with `?github=installation-connected`
  - D1 now contains the production installation grant and synced repositories
  - dashboard now shows `1 GitHub App installation` and `25/33 tracked repos`

## Issue #113 - Fix worker-backed read API status propagation

- Issue: [#113](https://github.com/rudrakshbhandari/vibe-tracker/issues/113)
- Branch: `rudrakshbhandari/fix-worker-read-proxy`
- PR: [#114](https://github.com/rudrakshbhandari/vibe-tracker/pull/114)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create the follow-up issue, task branch, and project tracking entry
- [x] Preserve worker response status/body for worker-backed metrics and social GET API routes
- [x] Add route coverage for the affected proxy endpoints
- [x] Run targeted verification for the updated routes and a production build
- [x] Push branch and open PR
- [ ] Deploy and complete one real production GitHub connect + sync flow

### Verification

- `npm test -- src/app/api/metrics/route.test.ts src/app/api/social/me/route.test.ts src/app/api/social/leaderboard/route.test.ts src/app/api/social/friends/route.test.ts 'src/app/api/social/profile/[login]/route.test.ts'`
- `npm run build`

## Issue #111 - Fix Cloudflare production config and deploy worker

- Issue: [#111](https://github.com/rudrakshbhandari/vibe-tracker/issues/111)
- Branch: `rudrakshbhandari/fix-cloudflare-production-config`
- PR: [#112](https://github.com/rudrakshbhandari/vibe-tracker/pull/112)
- Workflow: Blocked
- Priority: P1
- App: multi

### Checklist

- [x] Create the follow-up issue, task branch, and project tracking entry
- [x] Provision Cloudflare D1 and Queue resources for the worker runtime
- [x] Bind the production Worker to D1, the sync queue, and the production app URL in Wrangler config
- [x] Seed the Worker with non-empty shared runtime secrets that were available locally
- [x] Set `CLOUDFLARE_WORKER_URL` and `CLOUDFLARE_INTERNAL_API_TOKEN` in Vercel production and redeploy
- [x] Smoke test the deployed Vercel app and Cloudflare worker
- [ ] Restore real `GITHUB_APP_*` credentials in production so GitHub connect/setup can work

### Blocker

- Vercel production currently stores blank values for `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_APP_SLUG`, and no non-empty source for those secrets exists in this repo, local shell, local env files, or GitHub Actions secrets.

### Verification

- `npm run cloudflare:typecheck`
- `npm run cloudflare:test`
- `npx wrangler d1 migrations apply vibe-tracker-prod --remote --config cloudflare/worker/wrangler.jsonc`
- `npx wrangler deploy --config cloudflare/worker/wrangler.jsonc`
- `vercel --prod --yes`
- `curl -i https://vibe-tracker-max.vercel.app/api/session/reset`
- `curl -i https://vibe-tracker-worker.rudrakshbhandari99.workers.dev/health`

## Issue #109 - Complete Cloudflare migration by cutting over auth, sync controls, and social writes

- Issue: [#109](https://github.com/rudrakshbhandari/vibe-tracker/issues/109)
- Branch: `rudrakshbhandari/cloudflare-final-cutover`
- PR: [#110](https://github.com/rudrakshbhandari/vibe-tracker/pull/110)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create the follow-up issue, task branch, and project tracking entry
- [x] Add worker-backed GitHub connection/control endpoints for install, setup, scope, sync, and connection state
- [x] Add worker-backed social mutation and invite-detail endpoints
- [x] Add a same-origin Next proxy for worker auth/control/write flows, including cookie and redirect forwarding
- [x] Remove browser-polled sync processing from the active runtime path and switch the remaining SSR/API reads off Prisma session lookups
- [x] Run verification, push branch, and open PR

### Verification

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run cloudflare:typecheck`
- `npm run cloudflare:test`

## Issue #107 - Cut dashboard and social read paths over to the Cloudflare worker

- Issue: [#107](https://github.com/rudrakshbhandari/vibe-tracker/issues/107)
- Branch: `rudrakshbhandari/cloudflare-read-cutover`
- PR: [#108](https://github.com/rudrakshbhandari/vibe-tracker/pull/108)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create the follow-up issue, task branch, and project tracking entry
- [x] Add worker-authenticated read endpoints for dashboard and social GET payloads
- [x] Add a trusted Next-to-worker read proxy bridge
- [x] Cut the dashboard and social SSR/API GET paths over to the worker with local fallback
- [x] Add verification coverage for the worker read routes and proxy flow
- [x] Push branch and open PR

### Verification

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run cloudflare:typecheck`
- `npm run cloudflare:test`

## Issue #105 - Port installation metadata and repository activity sync to Cloudflare queues

- Issue: [#105](https://github.com/rudrakshbhandari/vibe-tracker/issues/105)
- Branch: `rudrakshbhandari/cloudflare-queue-sync`
- PR: [#106](https://github.com/rudrakshbhandari/vibe-tracker/pull/106)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create the follow-up issue, task branch, and project tracking entry
- [x] Add Worker GitHub App installation auth and queue bindings
- [x] Port installation metadata sync into the Worker queue consumer
- [x] Port repository activity sync plus daily stat persistence into the Worker queue consumer
- [x] Add verification coverage for the Worker queue sync flow
- [x] Push branch and open PR

### Verification

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run cloudflare:typecheck`
- `npm run cloudflare:test`

## Issue #103 - Port GitHub auth and sessions to the Cloudflare worker

- Issue: [#103](https://github.com/rudrakshbhandari/vibe-tracker/issues/103)
- Branch: `rudrakshbhandari/cloudflare-worker-auth`
- PR: [#104](https://github.com/rudrakshbhandari/vibe-tracker/pull/104)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create the follow-up issue, task branch, and project tracking entry
- [x] Add Worker-native GitHub auth configuration and crypto/session helpers
- [x] Implement Worker routes for GitHub connect, callback, and session reset
- [x] Add verification coverage for the Worker auth/session flow
- [x] Push branch and open PR

### Verification

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run cloudflare:typecheck`
- `npm run cloudflare:test`

## Issue #101 - Migrate backend to Cloudflare Workers, Queues, and D1

- Issue: [#101](https://github.com/rudrakshbhandari/vibe-tracker/issues/101)
- Branch: `rudrakshbhandari/cloudflare-full-cost-optimized`
- PR: [#102](https://github.com/rudrakshbhandari/vibe-tracker/pull/102)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Create the migration issue, task branch, and project tracking entry
- [x] Add the Cloudflare worker scaffold and bindings
- [x] Add the D1 schema and migration scripts
- [x] Implement queue contracts plus leaderboard and maintenance consumers
- [x] Add verification coverage for the new worker surface
- [x] Push branch and open PR

### Verification

- `npm test`
- `npm run build`
- `npm run cloudflare:typecheck`
- `npm run cloudflare:test`

## Issue #98 - Fix social invite copy link UX

- Issue: [#98](https://github.com/rudrakshbhandari/vibe-tracker/issues/98)
- Branch: `rudrakshbhandari/fix-social-invite-copy`
- PR: [#99](https://github.com/rudrakshbhandari/vibe-tracker/pull/99)
- Workflow: In Review
- Priority: P2
- App: multi

### Checklist

- [x] Reproduce the broken invite copy behavior and identify where the relative path is copied
- [x] Copy the absolute invite URL instead of the raw relative path
- [x] Reduce duplicate raw invite-link rendering in the social UI
- [x] Run lint, tests, and build
- [x] Push branch and open PR

### Verification

- `npm run lint`
- `npm test`
- `npm run build`

## Issue #97 - Harden public launch sync architecture and launch safety

- Issue: [#97](https://github.com/rudrakshbhandari/vibe-tracker/issues/97)
- Branch: `rudrakshbhandari/public-launch-hardening`
- PR: [#100](https://github.com/rudrakshbhandari/vibe-tracker/pull/100)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Move activity sync off the user click path into a queued worker flow
- [x] Add per-installation tracked-repository selection with a 25-repo cap
- [x] Add GitHub rate-limit aware retry/defer handling
- [x] Decouple global leaderboard refresh from routine activity sync
- [x] Expose sync queue health in the UI and metrics payload
- [x] Run Prisma generate, lint, tests, and build
- [x] Push branch and open PR

### Verification

- `npm run db:generate`
- `npm run lint`
- `npm test`
- `npm run build`

## Issue #95 - Tone down launch copy voice after merge

- Issue: [#95](https://github.com/rudrakshbhandari/vibe-tracker/issues/95)
- Branch: `rudrakshbhandari/soften-launch-copy`
- PR: [#96](https://github.com/rudrakshbhandari/vibe-tracker/pull/96)
- Workflow: In Review
- Priority: P2
- App: multi

### Checklist

- [x] Identify the copy that drifted into an overly assertive tone
- [x] Rewrite the launch surfaces to sound more understated without changing layout
- [x] Run lint, tests, and build
- [x] Push branch and open PR

### Verification

- `npm run lint`
- `npm test`
- `npm run build`

## Issue #90 - Prevent malformed PR body formatting from agent workflows

- Issue: [#90](https://github.com/rudrakshbhandari/vibe-tracker/issues/90)
- Branch: `rudrakshbhandari/prevent-pr-body-formatting`
- PR: [#91](https://github.com/rudrakshbhandari/vibe-tracker/pull/91)
- Workflow: In Review
- Priority: P2
- App: multi

### Checklist

- [x] Identify the failure mode that produced literal `\n` sequences in the PR body
- [x] Add a hard rule in `AGENTS.md` requiring real multiline GitHub markdown plus verification
- [x] Push branch and open PR

### Verification

- docs-only change; no app tests required

## Issue #88 - Rewrite product copy to match launch tone

- Issue: [#88](https://github.com/rudrakshbhandari/vibe-tracker/issues/88)
- Branch: `rudrakshbhandari/rewrite-project-copy`
- PR: [#89](https://github.com/rudrakshbhandari/vibe-tracker/pull/89)
- Workflow: In Review
- Priority: P2
- App: multi

### Checklist

- [x] Audit the homepage, social, invite, profile, and privacy copy surfaces
- [x] Rewrite the product copy without changing layout or styling
- [x] Run lint, tests, and build
- [x] Push branch and open PR

### Verification

- `npm run lint`
- `npm test`
- `npm run build`

## Issue #86 - Use a single reusable social invite link per user

- Issue: [#86](https://github.com/rudrakshbhandari/vibe-tracker/issues/86)
- Branch: `rudrakshbhandari/single-social-invite-link`
- PR: [#87](https://github.com/rudrakshbhandari/vibe-tracker/pull/87)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Confirm the social invite flow currently mints a new token on every click
- [x] Reuse one active pending invite per user and expire duplicate active tokens
- [x] Change the social action copy from create semantics to copy semantics
- [x] Run lint, tests, and build
- [x] Push branch and open PR

### Verification

- `npm run lint`
- `npm test`
- `npm run build`

## Issue #84 - Fix cramped panel heading spacing on dashboard cards

- Issue: [#84](https://github.com/rudrakshbhandari/vibe-tracker/issues/84)
- Branch: `rudrakshbhandari/fix-panel-heading-spacing`
- PR: [#85](https://github.com/rudrakshbhandari/vibe-tracker/pull/85)
- Workflow: In Review
- Priority: P2
- App: multi

### Checklist

- [x] Identify the shared typography styles driving panel label and heading spacing
- [x] Increase vertical separation between the panel label and heading
- [x] Loosen wrapped panel heading line-height without affecting page titles
- [x] Run lint and tests
- [x] Push branch and open PR
- [x] Update project tracking with the PR URL
- [x] Verify the visual change in the browser view

## Issue #82 - Fix signed-in social hydration and mobile overflow

- Issue: [#82](https://github.com/rudrakshbhandari/vibe-tracker/issues/82)
- Branch: `rudrakshbhandari/fix-social-ui-bugs`
- PR: [#83](https://github.com/rudrakshbhandari/vibe-tracker/pull/83)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Reproduce the signed-in social hydration mismatch and mobile invite overflow in the browser
- [x] Make signed-in social date labels render deterministically across server and client
- [x] Prevent invite links from overflowing narrow mobile viewports
- [x] Run lint, tests, and build under Node 20
- [ ] Verify the signed-in social fixes in the PR deployment browser session
- [x] Push branch and open PR

## Issue #80 - Patch dependency security updates after UI audit

- Issue: [#80](https://github.com/rudrakshbhandari/vibe-tracker/issues/80)
- Branch: `rudrakshbhandari/patch-security`
- PR: [#81](https://github.com/rudrakshbhandari/vibe-tracker/pull/81)
- Workflow: In Review
- Priority: P1
- App: multi

### Checklist

- [x] Patch dependencies to a clean `npm audit`
- [x] Re-run lint, tests, and build under Node 20
- [x] Investigate a full authenticated audit path after the UI review
- [x] Push branch and open PR

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
