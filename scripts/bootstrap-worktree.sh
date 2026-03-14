#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SHARED_ENV_PATH="${VIBE_TRACKER_SHARED_ENV:-$HOME/.config/vibe-tracker/.env.shared}"
DEFAULT_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/vibe_tracker?schema=public"
DEFAULT_DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54329/vibe_tracker?schema=public"

log() {
  printf '\n==> %s\n' "$1"
}

warn() {
  printf '\n[warn] %s\n' "$1"
}

if [[ -f .nvmrc && -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  log "Loading Node version from .nvmrc"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  unset npm_config_prefix
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
  nvm use >/dev/null
  export PATH="$NVM_BIN:$PATH"
fi

if [[ ! -f .env && -f "$SHARED_ENV_PATH" ]]; then
  log "Linking shared env from $SHARED_ENV_PATH"
  ln -s "$SHARED_ENV_PATH" .env
fi

if [[ ! -f .env ]]; then
  log "Creating local .env from .env.example"
  cp .env.example .env
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

export APP_URL="${APP_URL:-http://localhost:3000}"
export DATABASE_URL="${DATABASE_URL:-$DEFAULT_DATABASE_URL}"
export DIRECT_URL="${DIRECT_URL:-$DEFAULT_DIRECT_URL}"

if [[ ! -f "$SHARED_ENV_PATH" ]]; then
  warn "Shared env not found at $SHARED_ENV_PATH. GitHub OAuth values still need to be filled in locally or via the shared env file."
fi

if command -v docker >/dev/null 2>&1 && [[ "${SKIP_DB_UP:-0}" != "1" ]]; then
  log "Ensuring shared Postgres container is running"
  docker compose up -d db >/dev/null
fi

log "Installing dependencies"
npm install

log "Generating Prisma client"
npm run db:generate

if [[ -n "${DATABASE_URL:-}" && -n "${DIRECT_URL:-}" ]]; then
  log "Pushing Prisma schema"
  npm run db:push
else
  warn "Skipping prisma db push because DATABASE_URL or DIRECT_URL is missing."
fi

log "Bootstrap complete"
