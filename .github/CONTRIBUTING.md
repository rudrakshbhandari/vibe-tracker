# Contributing to Vibe Tracker

Thanks for contributing. This repo accepts outside contributions, but the process is intentionally structured so maintainers can keep product direction and quality tight before launch.

## What We Accept

- Bug fixes
- Documentation improvements
- Small UX polish
- Focused tests for existing behavior

## What Needs Approval First

Open an issue before you start if your change:

- adds a feature
- changes product behavior
- changes the data model or sync architecture
- adds dependencies
- changes authentication, GitHub, or database flows

Unapproved feature PRs may be closed even if the code is good. That is deliberate. The repo is public, but roadmap control stays with maintainers.

## Contribution Flow

1. Check existing issues first.
2. For non-trivial work, open or claim an issue before coding.
3. Fork the repo and create a task-specific branch.
4. Keep the change small and focused.
5. Run the full local validation suite before opening a PR:

```bash
npm install
npm run lint
npm test
npm run build
```

6. Open a PR that links the issue with `Closes #<number>`.

## Local Setup

```bash
nvm use 20.20.0
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run dev
```

If you are only working on docs or GitHub templates, you do not need a fully configured GitHub App.

## Pull Request Standards

- One logical change per PR
- No unrelated refactors
- Clear title and summary
- Tests included or updated when behavior changes
- Pass CI before requesting review

## Review Expectations

Maintainers review for:

- correctness
- product fit
- scope discipline
- test coverage
- operational safety around GitHub sync and Prisma

Large PRs are slower to review and more likely to be rejected. Small targeted PRs land faster.

## Good First Contributions

Look for issues labeled:

- `good first issue`
- `help wanted`
- `documentation`
- `bug`
- `maintainer approved`

## Need Help?

If the right approach is unclear, open an issue before building. That is better than writing a large speculative PR.
