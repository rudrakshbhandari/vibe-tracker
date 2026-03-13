#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: ./scripts/new-worktree.sh <branch-name> [path]" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BRANCH_NAME="$1"
DEFAULT_PATH="../$(basename "$ROOT_DIR")-${BRANCH_NAME//\//-}"
WORKTREE_PATH="${2:-$DEFAULT_PATH}"
SHARED_ENV_PATH="${VIBE_TRACKER_SHARED_ENV:-$HOME/.config/vibe-tracker/.env.shared}"

if [[ "$BRANCH_NAME" != */* ]]; then
  echo "Branch name should match repo policy, for example: rudrakshbhandari/my-task" >&2
  exit 1
fi

if [[ -e "$WORKTREE_PATH" ]]; then
  echo "Target path already exists: $WORKTREE_PATH" >&2
  exit 1
fi

echo "Fetching origin/main"
git fetch origin main

echo "Creating worktree at $WORKTREE_PATH on branch $BRANCH_NAME"
git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" origin/main

if [[ -f "$SHARED_ENV_PATH" && ! -e "$WORKTREE_PATH/.env" ]]; then
  echo "Linking shared env"
  ln -s "$SHARED_ENV_PATH" "$WORKTREE_PATH/.env"
fi

echo "Bootstrapping worktree"
"$WORKTREE_PATH/scripts/bootstrap-worktree.sh"

echo "Ready: $WORKTREE_PATH"
