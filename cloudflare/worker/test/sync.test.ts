import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleQueueBatch } from "@/jobs/consumer";
import type { VibeWorkerEnv } from "@/env";

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDIXV7SbByNOyYY
WFmK7FKNYzb/QqJ88Fe4yx8ST6y6bXHQWhwHcl4vMNfv7XedMTLIzPvkGXu7g87w
Rul0PD0Tgv2E3q5NGrrWB5E6jAbQ3X+QYgd/LluAJfHmNTUrbNI7P8xVHW32DhB5
GHThCFhEi74w6/AWJbkIwGarwCUXTIDzvuST2VVYg9D5FuPBR3Up7DJqbsrHfLk7
YGXyL4GhkmCCKQo37xrvpUscMVF7hZK34cKCRkSAckXTRo5lQ0O2i+KNI+jFRKJc
oKS1Qnd6SZYOA5whdbrUFVvxjQQWwmAjqz00jeCxC1ApGqVqPBOzpGJ49iP2ikSU
1s+51J3bAgMBAAECggEAQLRGZtWa8tDjIIGHiSGAF0CvBgfSyV4kNf0Cb7tjIGEv
nAU9f/ojCEJRuZ2KPy0gJVBtF+BS4N9T+Kwtv+ekIaTvkfUHfMbhBzUyZSHLIbAl
/c5qdVvXGK8oSxtrrDZcPd4AcowqcodgMnr/Y5x6RMiMBuhqg/xyoKzhex113Ou5
e5l+MfZhQSR7YzFMvRTvzx8llmFDKf8fbaWnyZHJ7GVTVqIMkM8NIKQ0lQLFaVbx
x84T2Jt50yic0QRmkRHxJiEH661r6W3f14i/aITtG/0GHXIEFHn5tEnecnulCPXO
I0jpGumFXZolDbzNJiHjcyFKctThluxKkweLovSNQQKBgQDmqeiAoaaV43ZRc5OA
7T39voJeS64v/C4OtQKe9Qi1QeZKdpWTDzbUpnn58S3QVi8XCWCPZkTI0Xp7g8N0
JbiQkKVr031ug2jekI1ETGBzFnonP7oCq7vBZYrYArsZ8juul7/J3peKM+WFdXW0
j7bnx6QBnDulgnORfjn+UhqIMwKBgQDeX3o+15R+PcbyoZFSTO2u6lZeoAxnXvKf
Vr5JP4Pxml8Dd1vhw0+92LVj7SNonSHmevo2XfYhwQi5mS+xhv+2xqdxZPZEkJso
IO8mVWFLvst9ADffWDxXzTvbsoIWNpZhgZO5vJn4JovNOBjuTVjhixRLIuS6Z1dG
Lx4dxfoLuQKBgHN0CgcQYlRV5OwCAIugs82lJJXUJZypCdicq3IqzbAECyOsVVOl
YtlvdlAvcrH74VgTfnxoQPePOlJGcndZRhc9/z6IPhkptzznd33/CKuyTXQFxrH9
iV3U2HkkbMgg4dSS6hE90/X94d06HK9C29cJq0KPE5/VOslRN+/e4p7XAoGBALJl
Jk0D5bzhEpnTxCGiVYvdsyx2eXz0TvBFRqK8sb1BerftKWkUpwRGtj5UH/PtGyUr
w0+aUbsCgV1j5z8kbkDTXcE6ndajq9WlljXKiSObDORbKHek8cP+gebebj4jzMCs
kzaOd3b8dWtNdbK3mnZWfRFKDPT9sqY7Zo28Jb0BAoGBANv7tkhqnmWvJWuyweYK
s/lDzaVNsCxY2QHCl3QMmzgFN6haUEKEVEPh3Zt5xufI042kVIlpYU41VnJwNJwZ
hcj2npwphT57HvfWAYUWdngiTwl4xlNbMnJfaR1jVX2mFKmP6ADrvJMXu0p9QWy9
NJgBveubC0WWIdlOzBCYle39
-----END PRIVATE KEY-----`;

type AccountRow = {
  id: string;
  github_user_id: number;
  login: string;
  display_name: string | null;
  avatar_url: string | null;
  leaderboard_visibility?: string;
  created_at: number;
  updated_at: number;
};

type InstallationRow = {
  id: string;
  github_install_id: number;
  account_type: string;
  account_login: string;
  target_type: string | null;
  permissions_json: string | null;
  created_at: number;
  updated_at: number;
};

type InstallationGrantRow = {
  id: string;
  account_id: string;
  installation_id: string;
  created_at: number;
  updated_at: number;
};

type RepositoryRow = {
  id: string;
  github_repo_id: number;
  owner: string;
  name: string;
  default_branch: string;
  is_private: number;
  pushed_at: number | null;
  sync_enabled: number;
  installation_id: string;
  created_at: number;
  updated_at: number;
};

type PullRequestRow = {
  id: string;
  github_pr_number: number;
  repository_id: string;
  author_id: string | null;
  title: string;
  base_branch: string;
  head_branch: string;
  state: string;
  additions: number;
  deletions: number;
  commit_count: number;
  opened_at: number;
  merged_at: number | null;
  created_at: number;
  updated_at: number;
};

type DailyStatRow = {
  id: string;
  account_id: string;
  repository_id: string;
  day_utc: string;
  additions: number;
  deletions: number;
  merged_pr_count: number;
  commit_count: number;
  created_at: number;
  updated_at: number;
};

type CursorRow = {
  id: string;
  installation_id: string;
  repository_id: string;
  scope: string;
  cursor_value: string;
  created_at: number;
  updated_at: number;
};

type SessionRow = {
  id: string;
  session_token_hash: string;
  account_id: string;
  github_access_token: string;
  github_access_token_expires_at: number | null;
  github_refresh_token: string | null;
  github_refresh_token_expires_at: number | null;
  expires_at: number;
  created_at: number;
  updated_at: number;
};

class FakePreparedStatement {
  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string,
    private args: unknown[] = [],
  ) {}

  bind(...args: unknown[]) {
    return new FakePreparedStatement(this.db, this.sql, args);
  }

  async first<T>() {
    return (this.db.first(this.sql, this.args) ?? null) as T | null;
  }

  async run() {
    this.db.run(this.sql, this.args);
    return { success: true };
  }

  async all<T>() {
    return { results: this.db.all(this.sql, this.args) as T[] };
  }
}

class FakeD1Database {
  readonly accounts: AccountRow[] = [];
  readonly sessions: SessionRow[] = [];
  readonly installations: InstallationRow[] = [];
  readonly installationGrants: InstallationGrantRow[] = [];
  readonly repositories: RepositoryRow[] = [];
  readonly pullRequests: PullRequestRow[] = [];
  readonly dailyStats: DailyStatRow[] = [];
  readonly syncCursors: CursorRow[] = [];

  prepare(sql: string) {
    return new FakePreparedStatement(this, sql);
  }

  async batch(statements: FakePreparedStatement[]) {
    for (const statement of statements) {
      await statement.run();
    }
  }

  first(sql: string, args: unknown[]) {
    if (sql.includes("SELECT id FROM github_accounts")) {
      const account = this.accounts.find(
        (row) => row.github_user_id === Number(args[0]),
      );
      return account ? { id: account.id } : null;
    }

    if (sql.includes("SELECT id FROM installations")) {
      const installation = this.installations.find(
        (row) => row.github_install_id === Number(args[0]),
      );
      return installation ? { id: installation.id } : null;
    }

    if (sql.includes("SELECT id FROM installation_grants")) {
      const grant = this.installationGrants.find(
        (row) =>
          row.account_id === String(args[0]) &&
          row.installation_id === String(args[1]),
      );
      return grant ? { id: grant.id } : null;
    }

    if (sql.includes("FROM daily_user_repo_stats")) {
      return (
        this.dailyStats.find(
          (row) =>
            row.account_id === String(args[0]) &&
            row.repository_id === String(args[1]) &&
            row.day_utc === String(args[2]),
        ) ?? null
      );
    }

    if (sql.includes("FROM pull_requests")) {
      return (
        this.pullRequests.find(
          (row) =>
            row.repository_id === String(args[0]) &&
            row.github_pr_number === Number(args[1]),
        ) ?? null
      );
    }

    if (sql.includes("FROM sync_cursors")) {
      const scope = String(args[1]);
      return (
        this.syncCursors.find(
          (row) =>
            row.repository_id === String(args[0]) && row.scope === scope,
        ) ?? null
      );
    }

    return null;
  }

  all(sql: string, args: unknown[]) {
    if (sql.includes("MAX(pull_requests.merged_at) AS latestMergedAt")) {
      const installationId = String(args[0]);
      const accountId = String(args[1]);
      const latestByRepo = new Map<number, number>();

      for (const repository of this.repositories.filter(
        (row) => row.installation_id === installationId,
      )) {
        for (const pullRequest of this.pullRequests.filter(
          (row) =>
            row.repository_id === repository.id &&
            row.author_id === accountId &&
            row.merged_at !== null,
        )) {
          const nextMergedAt = Number(pullRequest.merged_at);
          const existingMergedAt = latestByRepo.get(repository.github_repo_id) ?? 0;
          if (nextMergedAt > existingMergedAt) {
            latestByRepo.set(repository.github_repo_id, nextMergedAt);
          }
        }
      }

      return Array.from(latestByRepo.entries()).map(([githubRepoId, latestMergedAt]) => ({
        githubRepoId,
        latestMergedAt,
      }));
    }

    if (sql.includes("FROM repositories") && sql.includes("installation_id = ?")) {
      return this.repositories
        .filter((row) => row.installation_id === String(args[0]))
        .map((row) =>
          sql.includes("github_repo_id")
            ? {
                id: row.id,
                github_repo_id: row.github_repo_id,
                sync_enabled: row.sync_enabled,
                owner: row.owner,
                name: row.name,
                pushed_at: row.pushed_at,
              }
            : {
                id: row.id,
                owner: row.owner,
                name: row.name,
                sync_enabled: row.sync_enabled,
              },
        );
    }

    return [];
  }

  run(sql: string, args: unknown[]) {
    if (sql.includes("INSERT INTO github_accounts")) {
      const existing = this.accounts.find(
        (row) => row.github_user_id === Number(args[1]),
      );

      if (existing) {
        existing.login = String(args[2]);
        existing.display_name = (args[3] as string | null) ?? null;
        existing.avatar_url = (args[4] as string | null) ?? null;
        existing.updated_at = Number(args[6]);
        return;
      }

      this.accounts.push({
        id: String(args[0]),
        github_user_id: Number(args[1]),
        login: String(args[2]),
        display_name: (args[3] as string | null) ?? null,
        avatar_url: (args[4] as string | null) ?? null,
        leaderboard_visibility: "PUBLIC",
        created_at: Number(args[5]),
        updated_at: Number(args[6]),
      });
      return;
    }

    if (sql.includes("INSERT INTO installations")) {
      const existing = this.installations.find(
        (row) => row.github_install_id === Number(args[1]),
      );

      if (existing) {
        existing.account_type = String(args[2]);
        existing.account_login = String(args[3]);
        existing.target_type = (args[4] as string | null) ?? null;
        existing.permissions_json = (args[5] as string | null) ?? null;
        existing.updated_at = Number(args[7]);
        return;
      }

      this.installations.push({
        id: String(args[0]),
        github_install_id: Number(args[1]),
        account_type: String(args[2]),
        account_login: String(args[3]),
        target_type: (args[4] as string | null) ?? null,
        permissions_json: (args[5] as string | null) ?? null,
        created_at: Number(args[6]),
        updated_at: Number(args[7]),
      });
      return;
    }

    if (sql.includes("INSERT INTO installation_grants")) {
      const existing = this.installationGrants.find(
        (row) =>
          row.account_id === String(args[1]) &&
          row.installation_id === String(args[2]),
      );

      if (existing) {
        existing.updated_at = Number(args[4]);
        return;
      }

      this.installationGrants.push({
        id: String(args[0]),
        account_id: String(args[1]),
        installation_id: String(args[2]),
        created_at: Number(args[3]),
        updated_at: Number(args[4]),
      });
      return;
    }

    if (sql.includes("DELETE FROM daily_user_repo_stats WHERE repository_id = ?")) {
      const keep = this.dailyStats.filter(
        (row) => row.repository_id !== String(args[0]),
      );
      this.dailyStats.splice(0, this.dailyStats.length, ...keep);
      return;
    }

    if (sql.includes("DELETE FROM pull_requests WHERE repository_id = ?")) {
      const keep = this.pullRequests.filter(
        (row) => row.repository_id !== String(args[0]),
      );
      this.pullRequests.splice(0, this.pullRequests.length, ...keep);
      return;
    }

    if (sql.includes("DELETE FROM sync_cursors WHERE repository_id = ?")) {
      const keep = this.syncCursors.filter(
        (row) => row.repository_id !== String(args[0]),
      );
      this.syncCursors.splice(0, this.syncCursors.length, ...keep);
      return;
    }

    if (sql.includes("DELETE FROM repositories WHERE id = ?")) {
      const keep = this.repositories.filter((row) => row.id !== String(args[0]));
      this.repositories.splice(0, this.repositories.length, ...keep);
      return;
    }

    if (sql.includes("INSERT INTO repositories")) {
      const existing = this.repositories.find(
        (row) => row.github_repo_id === Number(args[1]),
      );

      if (existing) {
        existing.owner = String(args[2]);
        existing.name = String(args[3]);
        existing.default_branch = String(args[4]);
        existing.is_private = Number(args[5]);
        existing.pushed_at = (args[6] as number | null) ?? null;
        existing.sync_enabled = Number(args[7]);
        existing.installation_id = String(args[8]);
        existing.updated_at = Number(args[10]);
        return;
      }

      this.repositories.push({
        id: String(args[0]),
        github_repo_id: Number(args[1]),
        owner: String(args[2]),
        name: String(args[3]),
        default_branch: String(args[4]),
        is_private: Number(args[5]),
        pushed_at: (args[6] as number | null) ?? null,
        sync_enabled: Number(args[7]),
        installation_id: String(args[8]),
        created_at: Number(args[9]),
        updated_at: Number(args[10]),
      });
      return;
    }

    if (sql.includes("DELETE FROM daily_user_repo_stats WHERE id = ?")) {
      const keep = this.dailyStats.filter((row) => row.id !== String(args[0]));
      this.dailyStats.splice(0, this.dailyStats.length, ...keep);
      return;
    }

    if (sql.includes("INSERT INTO daily_user_repo_stats")) {
      const existing = this.dailyStats.find(
        (row) =>
          row.account_id === String(args[1]) &&
          row.repository_id === String(args[2]) &&
          row.day_utc === String(args[3]),
      );

      if (existing) {
        existing.additions = Number(args[4]);
        existing.deletions = Number(args[5]);
        existing.merged_pr_count = Number(args[6]);
        existing.commit_count = Number(args[7]);
        existing.updated_at = Number(args[9]);
        return;
      }

      this.dailyStats.push({
        id: String(args[0]),
        account_id: String(args[1]),
        repository_id: String(args[2]),
        day_utc: String(args[3]),
        additions: Number(args[4]),
        deletions: Number(args[5]),
        merged_pr_count: Number(args[6]),
        commit_count: Number(args[7]),
        created_at: Number(args[8]),
        updated_at: Number(args[9]),
      });
      return;
    }

    if (sql.includes("INSERT INTO pull_requests")) {
      const existing = this.pullRequests.find(
        (row) =>
          row.repository_id === String(args[2]) &&
          row.github_pr_number === Number(args[1]),
      );

      if (existing) {
        existing.author_id = (args[3] as string | null) ?? null;
        existing.title = String(args[4]);
        existing.base_branch = String(args[5]);
        existing.head_branch = String(args[6]);
        existing.state = String(args[7]);
        existing.additions = Number(args[8]);
        existing.deletions = Number(args[9]);
        existing.commit_count = Number(args[10]);
        existing.opened_at = Number(args[11]);
        existing.merged_at = Number(args[12]);
        existing.updated_at = Number(args[14]);
        return;
      }

      this.pullRequests.push({
        id: String(args[0]),
        github_pr_number: Number(args[1]),
        repository_id: String(args[2]),
        author_id: (args[3] as string | null) ?? null,
        title: String(args[4]),
        base_branch: String(args[5]),
        head_branch: String(args[6]),
        state: String(args[7]),
        additions: Number(args[8]),
        deletions: Number(args[9]),
        commit_count: Number(args[10]),
        opened_at: Number(args[11]),
        merged_at: Number(args[12]),
        created_at: Number(args[13]),
        updated_at: Number(args[14]),
      });
      return;
    }

    if (sql.includes("INSERT INTO sync_cursors")) {
      const existing = this.syncCursors.find(
        (row) =>
          row.repository_id === String(args[2]) && row.scope === String(args[3]),
      );

      if (existing) {
        existing.installation_id = String(args[1]);
        existing.cursor_value = String(args[4]);
        existing.updated_at = Number(args[6]);
        return;
      }

      this.syncCursors.push({
        id: String(args[0]),
        installation_id: String(args[1]),
        repository_id: String(args[2]),
        scope: String(args[3]),
        cursor_value: String(args[4]),
        created_at: Number(args[5]),
        updated_at: Number(args[6]),
      });
      return;
    }

    if (sql.includes("INSERT INTO user_sessions")) {
      this.sessions.push({
        id: String(args[0]),
        session_token_hash: String(args[1]),
        account_id: String(args[2]),
        github_access_token: String(args[3]),
        github_access_token_expires_at: (args[4] as number | null) ?? null,
        github_refresh_token: (args[5] as string | null) ?? null,
        github_refresh_token_expires_at: (args[6] as number | null) ?? null,
        expires_at: Number(args[7]),
        created_at: Number(args[8]),
        updated_at: Number(args[9]),
      });
      return;
    }

    if (sql.includes("DELETE FROM user_sessions")) {
      const keep = this.sessions.filter(
        (row) =>
          row.session_token_hash !== String(args[0]) &&
          row.session_token_hash !== String(args[1]),
      );
      this.sessions.splice(0, this.sessions.length, ...keep);
    }
  }
}

class FakeQueue {
  readonly sent: unknown[] = [];

  async send(message: unknown) {
    this.sent.push(message);
  }
}

function createEnv(overrides: Partial<VibeWorkerEnv> = {}) {
  return {
    APP_URL: "https://worker.example.com",
    DB: new FakeD1Database() as unknown as D1Database,
    GITHUB_APP_ID: "12345",
    GITHUB_APP_CLIENT_ID: "client-id",
    GITHUB_APP_CLIENT_SECRET: "client-secret",
    GITHUB_APP_PRIVATE_KEY: TEST_PRIVATE_KEY,
    GITHUB_APP_SLUG: "vibe-tracker",
    SESSION_ENCRYPTION_KEY: "session-key",
    SYNC_QUEUE: new FakeQueue() as unknown as Queue<unknown>,
    ...overrides,
  } satisfies VibeWorkerEnv;
}

function createBatch(messages: unknown[]): MessageBatch<unknown> {
  return {
    messages: messages.map((body) => ({
      body,
      ack: vi.fn(),
      retry: vi.fn(),
    })),
    queue: "sync-queue",
    retryAll: vi.fn(),
    ackAll: vi.fn(),
  } as unknown as MessageBatch<unknown>;
}

describe("worker queue sync flow", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", originalFetch);
  });

  it("syncs installation metadata and enqueues repository work", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "install-token" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            repositories: [
              {
                id: 501,
                name: "api",
                full_name: "octo-org/api",
                private: false,
                default_branch: "main",
                pushed_at: "2026-03-20T10:00:00.000Z",
                owner: { login: "octo-org" },
              },
            ],
          }),
        ),
      );

    const env = createEnv();
    const batch = createBatch([
      {
        type: "installation-sync",
        accountId: "account-1",
        installation: {
          githubInstallationId: 77,
          accountLogin: "octo-org",
          accountType: "Organization",
          targetType: "organization",
          permissions: { contents: "read" },
        },
      },
    ]);

    await handleQueueBatch(env, batch);

    const db = env.DB as unknown as FakeD1Database;
    const queue = env.SYNC_QUEUE as unknown as FakeQueue;

    expect(db.installations).toHaveLength(1);
    expect(db.repositories).toHaveLength(1);
    expect(queue.sent).toEqual([
      expect.objectContaining({
        type: "repository-sync",
        accountId: "account-1",
        githubInstallationId: 77,
        owner: "octo-org",
        repo: "api",
      }),
    ]);
  });

  it("prefers repo recency over alphabetical order for initial auto-selection", async () => {
    const env = createEnv();

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "install-token" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            repositories: [
              ...Array.from({ length: 25 }, (_, index) => ({
                id: 200 + index,
                name: `repo-${index.toString().padStart(2, "0")}`,
                full_name: `octo-org/repo-${index.toString().padStart(2, "0")}`,
                private: false,
                default_branch: "main",
                pushed_at: new Date(Date.UTC(2026, 2, 1 + index)).toISOString(),
                owner: { login: "octo-org" },
              })),
              {
                id: 100,
                name: "aardvark",
                full_name: "octo-org/aardvark",
                private: false,
                default_branch: "main",
                pushed_at: "2026-01-01T10:00:00.000Z",
                owner: { login: "octo-org" },
              },
            ],
          }),
        ),
      );

    const batch = createBatch([
      {
        type: "installation-sync",
        accountId: "account-1",
        installation: {
          githubInstallationId: 77,
          accountLogin: "octo-org",
          accountType: "Organization",
          targetType: "organization",
          permissions: { contents: "read" },
        },
      },
    ]);

    await handleQueueBatch(env, batch);

    const db = env.DB as unknown as FakeD1Database;
    const queue = env.SYNC_QUEUE as unknown as FakeQueue;
    const syncedRepoNames = queue.sent.map(
      (message) => (message as { repo: string }).repo,
    );
    expect(syncedRepoNames).toContain("repo-24");
    expect(syncedRepoNames).not.toContain("aardvark");
    expect(db.repositories.find((row) => row.github_repo_id === 224)?.sync_enabled).toBe(1);
    expect(db.repositories.find((row) => row.github_repo_id === 100)?.sync_enabled).toBe(0);
  });

  it("syncs repository pull requests, persists aggregates, and enqueues leaderboard work", async () => {
    const env = createEnv();
    const db = env.DB as unknown as FakeD1Database;
    db.installations.push({
      id: "installation-row",
      github_install_id: 77,
      account_type: "Organization",
      account_login: "octo-org",
      target_type: "organization",
      permissions_json: "{}",
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    db.repositories.push({
      id: "repo-row",
      github_repo_id: 501,
      owner: "octo-org",
      name: "api",
      default_branch: "main",
      is_private: 0,
      pushed_at: Date.now(),
      sync_enabled: 1,
      installation_id: "installation-row",
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "install-token" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              number: 12,
              state: "closed",
              title: "Ship queue sync",
              user: {
                id: 9001,
                login: "octocat",
                avatar_url: "https://avatars.example.com/octocat",
              },
              created_at: "2026-03-24T10:00:00.000Z",
              updated_at: "2026-03-25T11:00:00.000Z",
              merged_at: "2026-03-25T11:00:00.000Z",
            },
          ]),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "install-token" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            number: 12,
            state: "closed",
            title: "Ship queue sync",
            user: {
              id: 9001,
              login: "octocat",
              avatar_url: "https://avatars.example.com/octocat",
            },
            created_at: "2026-03-24T10:00:00.000Z",
            updated_at: "2026-03-25T11:00:00.000Z",
            merged_at: "2026-03-25T11:00:00.000Z",
            additions: 42,
            deletions: 8,
            commits: 3,
            base: { ref: "main" },
            head: { ref: "queue-sync" },
          }),
        ),
      );

    const batch = createBatch([
      {
        type: "repository-sync",
        accountId: "account-1",
        installationId: "installation-row",
        githubInstallationId: 77,
        repositoryId: "repo-row",
        owner: "octo-org",
        repo: "api",
      },
    ]);

    await handleQueueBatch(env, batch);

    const queue = env.SYNC_QUEUE as unknown as FakeQueue;

    expect(db.accounts.some((account) => account.login === "octocat")).toBe(true);
    expect(db.pullRequests).toHaveLength(1);
    expect(db.dailyStats).toEqual([
      expect.objectContaining({
        repository_id: "repo-row",
        additions: 42,
        deletions: 8,
        merged_pr_count: 1,
        commit_count: 3,
      }),
    ]);
    expect(db.syncCursors).toEqual([
      expect.objectContaining({
        repository_id: "repo-row",
        cursor_value: "2026-03-25T11:00:00.000Z",
      }),
    ]);
    expect(queue.sent).toEqual([
      {
        type: "leaderboard-update",
        accountId: "account-1",
      },
    ]);
  });
});
