# Vibe Tracker - AGENTS.md

This file defines project-wide instructions for AI agents working in this repository.

## Core AI Behavior (All Apps)

1. Be direct and opinionated. If you see a better approach, say so with reasoning.
2. Challenge bad ideas (security, performance, architecture, typing, missing error handling).
3. Stay focused. Write code first, explain only when needed.
4. Use best practices.
5. No placeholders or TODOs. Production‑ready output only.
6. If something is unclear, ask clarifying questions as needed.
7. **Always run relevant tests yourself** (install deps if needed). Do not ask the user to run tests you can execute. If tests fail, fix or report with exact output.

**Response style**: concise, confident, practical, proactive.

---

## Git Workflow Requirements

### Hard rule: never commit directly to main

**Agents must never commit directly to `main`.** All changes go through feature branches and pull requests.

Required flow for any code change:

1. **Create a feature branch with a name that matches the task** (e.g. `rudrakshbhandari/grant-admin-script` for grant-admin work, not `rudrakshbhandari/some-other-task`). Branch name must describe the work.
2. Make changes and commit on the branch
3. **Push the branch** to origin
4. **Open a PR** targeting `main`
5. Inform user: `Branch pushed. PR: <url>`

Do not skip the branch. Do not push to `main` from the agent. **Do not commit to an existing branch if the branch name does not match the current task**—create a new appropriately named branch instead.

---

### Hard rule: always commit and push immediately after edits

**Do not leave uncommitted changes.** After making any code or doc edits, agents must commit and push in the **same response**—without waiting for the user to ask. Treat this as automatic; the user should never have to say "commit" or "push" to get changes persisted to the branch.

Pre-edit gate (must run before any file edit command):

1. Run `git rev-parse --abbrev-ref HEAD`.
2. If branch is `main`, STOP and create a task branch first: `git checkout -b rudrakshbhandari/<task>`.
3. If branch name does not match the task, STOP and create the correct branch.
4. Only then edit files.

If an agent edits files while on `main`, it must immediately:

1. Create the correct task branch.
2. Keep the edits (do not discard user work).
3. Commit, push, and open a PR in the same response.
4. Explicitly report the mistake and the corrective action taken.

Process (execute as soon as edits are done):

1. Ensure you are on a branch whose name matches the task. If not, create one: `git checkout -b rudrakshbhandari/<task>` (from `main` or the correct base).
2. `git status` / `git diff`
3. `git add <changed-files>` (exclude build artifacts, coverage dirs, `.env`)
4. `git commit -m "type: description"`
5. `git push origin <branch>`
6. Open PR (or inform user if PR already exists)

**After any code change on a branch, always commit** using conventional commits.

Conventional examples:

- `feat: add Google sign-in with @ucsd.edu validation`
- `fix: correct order total calculation with tip`
- `refactor: extract order form to separate component`
- `docs: update Firebase setup guide`
- `chore: update dependencies`

### GitHub Project + Docs Sync (Required)

Liftlytics uses a **hybrid system**:

1. **GitHub Project** = planning/status source of truth (priority, owner, current stage)
2. **In-repo docs/checklists** = implementation/runbook source of truth (exact steps, constraints, evidence)

Agents must keep both layers synchronized automatically.

#### Required issue/PR linkage

- Every task that will result in a PR must have a GitHub Issue.
- Every PR must link its Issue (`Closes #<issue-number>`).
- `docs/EXECUTION_PLAN.md` must include the Issue number and PR URL once opened.

#### Required project fields (minimum)

Maintain these fields on the NomNom GitHub Project item for the linked Issue:

- `Workflow` (or Status): `Backlog | Ready | In Progress | In Review | Blocked | Done`
- `Priority`: `P0 | P1 | P2 | P3`
- `App`: `student | rider | admin | multi`
- `PR`: PR URL (when available)

If a field does not exist yet, the agent must report it and still update all available fields.

#### Concrete workflow template (minimal overhead)

Use this template for every task that will have a PR. **Branch first, then code—never commit to main.**

1. **Create/find Issue** (planning record)
2. **Create and checkout feature branch** (`git checkout -b rudrakshbhandari/<task>`). Branch name must match the task—do not reuse an unrelated branch (e.g. do not commit grant-admin work to `increase-test-coverage`).
3. **Add Issue/PR to Project**
4. **Set/update Project fields**
5. **Update `docs/EXECUTION_PLAN.md` checklist in same change set**
6. **Open PR, then update Project + plan docs**
7. **After merge, move Project item to Done and close checklist**

Canonical commands:

```bash
# Add issue/pr to project
gh project item-add 1 --owner rudrakshbhandari --url <ISSUE_OR_PR_URL>

# Inspect fields and option IDs
gh project field-list 1 --owner rudrakshbhandari --format json

# Update a single-select field
gh project item-edit --id <ITEM_ID> --project-id PVT_kwHOAyk4hs4BPfYq \
  --field-id <FIELD_ID> --single-select-option-id <OPTION_ID>

# Update a text field
gh project item-edit --id <ITEM_ID> --project-id PVT_kwHOAyk4hs4BPfYq \
  --field-id <FIELD_ID> --text "<VALUE>"

# List current project items
gh project item-list 1 --owner rudrakshbhandari --limit 200 --format json
```

Field intent mapping:

- `Workflow`: stage gate (`Backlog`/`Ready`/`In Progress`/`In Review`/`Blocked`/`Done`)
- `Priority`: severity/urgency (`P0..P3`)
- `App`: ownership scope (`student`/`rider`/`admin`/`multi`)
- `Execution Plan`: pointer to task section in `docs/EXECUTION_PLAN.md`
- `PR`: canonical PR URL
- `Blocked Reason`: plain-language blocker when `Workflow=Blocked`

#### Required synchronization events

1. **Task start**:

- Ensure Issue exists and is linked.
- Set Project `Workflow=In Progress`, set `App`.
- Add/update `docs/EXECUTION_PLAN.md` section for the task.

2. **First implementation commit**:

- Update checklist progress in `docs/EXECUTION_PLAN.md`.
- Commit doc + code updates together when they describe the same work.

3. **PR opened**:

- Set Project `Workflow=In Review`, set `PR` field.
- Add PR URL and test summary to `docs/EXECUTION_PLAN.md`.

4. **PR merged**:

- Set Project `Workflow=Done`.
- Mark execution checklist complete and archive/move completed items in plan docs.

#### Hard gate

- A task is not complete unless:
  - Issue is linked
  - Project item is updated through the latest stage
  - `docs/EXECUTION_PLAN.md` reflects current checklist state
  - PR exists (when a PR is expected)

If GitHub Project access is unavailable (auth/API/permission error), the agent must:

1. show exact command + error output,
2. update local docs anyway,
3. report status as `incomplete` with the specific blocker.

### Definition of Done (substantial tasks)

- A task is only complete when a PR is opened and the PR URL is shared with the user (when a PR is expected).
- If the root PR contains cross-app changes, ensure app-specific tests pass before opening the PR.

---

## Test Execution Policy

- Run tests locally for each app you change.
- If dependencies are missing, install them and proceed.
- Report results with pass/fail and key warnings.
- Only ask the user to run tests if local execution is impossible.

---

## Design System (Student + Rider)

**Never hardcode design values.** Always import from the centralized theme.

```ts
import { colors, spacing, typography, borderRadius } from "../config/theme";
```

Theme provides: `colors`, `spacing`, `typography`, `borderRadius`, `shadows` (and `commonStyles` in rider).

---

## TypeScript Standards

- Always use type-only imports for types.
- Never use `any`.

```ts
import type { User, Order } from "../types/firestore";
```

---

## Error Handling (Required)

Every async Firebase call must be wrapped in try/catch with user-visible errors.

---

## Root Documentation Policy

**Only essential high-level docs in root.** The root directory must not be cluttered with `.md` files.

- **Root allowed:** `README.md`, `AGENTS.md` only.
- **Everything else:** Put in `docs/`. New docs (runbooks, playbooks, architecture, checklists, guides, analysis) go in `docs/`.

Enforce this for all new documentation. If you create a doc that belongs at repo level, place it in `docs/`, not root.

---

## Environment Variables

`.env` files must never be committed. Always verify `.gitignore` includes `.env`.

---

## When Unsure

1. Check existing code patterns in the app.
2. Prefer official docs for third‑party APIs.
3. Ask specific questions.
4. Test immediately.

**Remember**: Quality > speed.
