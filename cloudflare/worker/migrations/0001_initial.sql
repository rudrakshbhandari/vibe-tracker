CREATE TABLE github_accounts (
  id TEXT PRIMARY KEY,
  github_user_id INTEGER NOT NULL UNIQUE,
  login TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  profile_visibility TEXT NOT NULL DEFAULT 'PRIVATE',
  leaderboard_visibility TEXT NOT NULL DEFAULT 'PUBLIC',
  social_onboarding_completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  session_token_hash TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  github_access_token TEXT NOT NULL,
  github_access_token_expires_at INTEGER,
  github_refresh_token TEXT,
  github_refresh_token_expires_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE installations (
  id TEXT PRIMARY KEY,
  github_install_id INTEGER NOT NULL UNIQUE,
  account_type TEXT NOT NULL,
  account_login TEXT NOT NULL,
  target_type TEXT,
  permissions_json TEXT,
  sync_selection_updated_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE installation_grants (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(account_id, installation_id)
);

CREATE TABLE repositories (
  id TEXT PRIMARY KEY,
  github_repo_id INTEGER NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  default_branch TEXT NOT NULL,
  is_private INTEGER NOT NULL,
  sync_enabled INTEGER NOT NULL DEFAULT 1,
  installation_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE pull_requests (
  id TEXT PRIMARY KEY,
  github_pr_number INTEGER NOT NULL,
  repository_id TEXT NOT NULL,
  author_id TEXT,
  title TEXT NOT NULL,
  base_branch TEXT NOT NULL,
  head_branch TEXT NOT NULL,
  state TEXT NOT NULL,
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  commit_count INTEGER NOT NULL DEFAULT 0,
  opened_at INTEGER NOT NULL,
  merged_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(repository_id, github_pr_number)
);

CREATE TABLE daily_user_repo_stats (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  repository_id TEXT NOT NULL,
  day_utc TEXT NOT NULL,
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  merged_pr_count INTEGER NOT NULL DEFAULT 0,
  commit_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(account_id, repository_id, day_utc)
);

CREATE TABLE sync_cursors (
  id TEXT PRIMARY KEY,
  installation_id TEXT,
  repository_id TEXT,
  scope TEXT NOT NULL,
  cursor_value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(repository_id, scope)
);

CREATE TABLE sync_jobs (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  installation_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL,
  lease_token TEXT,
  lease_expires_at INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  started_at INTEGER,
  finished_at INTEGER,
  cursor TEXT,
  error_message TEXT,
  result_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE friend_connections (
  id TEXT PRIMARY KEY,
  requester_account_id TEXT NOT NULL,
  addressee_account_id TEXT NOT NULL,
  pair_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE friend_invites (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  inviter_account_id TEXT NOT NULL,
  claimed_by_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  expires_at INTEGER NOT NULL,
  claimed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE leaderboard_scores (
  account_id TEXT NOT NULL,
  window TEXT NOT NULL,
  vibe_score INTEGER NOT NULL,
  merged_additions INTEGER NOT NULL,
  merged_deletions INTEGER NOT NULL,
  merged_commits INTEGER NOT NULL,
  active_periods INTEGER NOT NULL,
  trend_delta INTEGER NOT NULL,
  calculated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, window)
);

CREATE TABLE leaderboard_ranks (
  window TEXT NOT NULL,
  rank INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  vibe_score INTEGER NOT NULL,
  merged_additions INTEGER NOT NULL,
  merged_deletions INTEGER NOT NULL,
  merged_commits INTEGER NOT NULL,
  active_periods INTEGER NOT NULL,
  trend_delta INTEGER NOT NULL,
  calculated_at INTEGER NOT NULL,
  PRIMARY KEY (window, rank)
);

CREATE INDEX idx_daily_stats_account_day
  ON daily_user_repo_stats(account_id, day_utc);

CREATE INDEX idx_repo_installation
  ON repositories(installation_id, sync_enabled);

CREATE INDEX idx_pr_repo_merged
  ON pull_requests(repository_id, merged_at);

CREATE INDEX idx_sync_jobs_status_lease
  ON sync_jobs(status, lease_expires_at, created_at);

CREATE INDEX idx_friend_requester_status
  ON friend_connections(requester_account_id, status);

CREATE INDEX idx_friend_addressee_status
  ON friend_connections(addressee_account_id, status);
