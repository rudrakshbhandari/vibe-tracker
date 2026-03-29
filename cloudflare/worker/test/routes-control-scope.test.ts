import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleGitHubInstallationRecommendedScope,
  handleGitHubState,
} from "@/routes/control";
import type { VibeWorkerEnv } from "@/env";

const { getRequestAccountIdMock } = vi.hoisted(() => ({
  getRequestAccountIdMock: vi.fn(),
}));

vi.mock("@/lib/request-auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/request-auth")>("@/lib/request-auth");
  return {
    ...actual,
    getRequestAccountId: getRequestAccountIdMock,
  };
});

type InstallationGrantRow = {
  account_id: string;
  installation_id: string;
};

type InstallationRow = {
  id: string;
  github_install_id: number;
  account_login: string;
  account_type: string;
  target_type: string | null;
  permissions_json: string | null;
  sync_selection_updated_at?: number | null;
  updated_at?: number;
};

type RepositoryRow = {
  id: string;
  installation_id: string;
  github_repo_id: number;
  owner: string;
  name: string;
  sync_enabled: number;
  pushed_at: number | null;
  updated_at: number;
};

type PullRequestRow = {
  repository_id: string;
  author_id: string | null;
  merged_at: number | null;
};

type AccountRow = {
  id: string;
  login: string;
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

  async all<T>() {
    return { results: this.db.all(this.sql, this.args) as T[] };
  }

  async run() {
    this.db.run(this.sql, this.args);
    return { success: true };
  }
}

class FakeD1Database {
  readonly accounts: AccountRow[] = [
    {
      id: "account-1",
      login: "rudrakshbhandari",
    },
  ];

  readonly installationGrants: InstallationGrantRow[] = [
    {
      account_id: "account-1",
      installation_id: "installation-row",
    },
  ];

  readonly installations: InstallationRow[] = [
    {
      id: "installation-row",
      github_install_id: 77,
      account_login: "octo-org",
      account_type: "Organization",
      target_type: "organization",
      permissions_json: "{}",
    },
  ];

  readonly repositories: RepositoryRow[] = [
    {
      id: "repo-a",
      installation_id: "installation-row",
      github_repo_id: 100,
      owner: "octo-org",
      name: "aardvark",
      sync_enabled: 1,
      pushed_at: Date.parse("2026-01-01T00:00:00.000Z"),
      updated_at: 1,
    },
    {
      id: "repo-b",
      installation_id: "installation-row",
      github_repo_id: 200,
      owner: "octo-org",
      name: "buzz",
      sync_enabled: 0,
      pushed_at: Date.parse("2026-03-22T00:00:00.000Z"),
      updated_at: 1,
    },
    {
      id: "repo-c",
      installation_id: "installation-row",
      github_repo_id: 300,
      owner: "octo-org",
      name: "campus",
      sync_enabled: 0,
      pushed_at: Date.parse("2026-03-18T00:00:00.000Z"),
      updated_at: 1,
    },
  ];

  readonly pullRequests: PullRequestRow[] = [
    {
      repository_id: "repo-c",
      author_id: "account-1",
      merged_at: Date.parse("2026-03-25T00:00:00.000Z"),
    },
    {
      repository_id: "repo-b",
      author_id: "account-1",
      merged_at: Date.parse("2026-03-20T00:00:00.000Z"),
    },
  ];

  prepare(sql: string) {
    return new FakePreparedStatement(this, sql);
  }

  async batch(statements: FakePreparedStatement[]) {
    for (const statement of statements) {
      await statement.run();
    }
  }

  first(sql: string, args: unknown[]) {
    if (sql.includes("SELECT login") && sql.includes("FROM github_accounts")) {
      return this.accounts.find((row) => row.id === String(args[0])) ?? null;
    }

    return null;
  }

  all(sql: string, args: unknown[]) {
    if (sql.includes("FROM installation_grants")) {
      const accountId = String(args[0]);
      return this.installationGrants
        .filter((grant) => grant.account_id === accountId)
        .flatMap((grant) => {
          const installation = this.installations.find(
            (row) => row.id === grant.installation_id,
          );
          if (!installation) {
            return [];
          }

          return this.repositories
            .filter((repository) => repository.installation_id === installation.id)
            .map((repository) => ({
              installationId: installation.id,
              githubInstallId: installation.github_install_id,
              accountLogin: installation.account_login,
              accountType: installation.account_type,
              targetType: installation.target_type,
              permissionsJson: installation.permissions_json,
              repositoryId: repository.id,
              repositoryGithubRepoId: repository.github_repo_id,
              repositoryName: repository.name,
              repositoryOwner: repository.owner,
              syncEnabled: repository.sync_enabled,
              pushedAt: repository.pushed_at,
              latestMergedAt: Math.max(
                0,
                ...this.pullRequests
                  .filter(
                    (pullRequest) =>
                      pullRequest.repository_id === repository.id &&
                      pullRequest.author_id === accountId &&
                      pullRequest.merged_at !== null,
                  )
                  .map((pullRequest) => pullRequest.merged_at ?? 0),
              ),
            }));
        });
    }

    return [];
  }

  run(sql: string, args: unknown[]) {
    if (sql.includes("UPDATE repositories") && sql.includes("SET sync_enabled = 0")) {
      const installationId = String(args[1]);
      for (const repository of this.repositories.filter(
        (row) => row.installation_id === installationId,
      )) {
        repository.sync_enabled = 0;
        repository.updated_at = Number(args[0]);
      }
      return;
    }

    if (sql.includes("UPDATE repositories") && sql.includes("SET sync_enabled = 1")) {
      const installationId = String(args[1]);
      const ids = new Set(args.slice(2).map(String));
      for (const repository of this.repositories.filter(
        (row) => row.installation_id === installationId && ids.has(row.id),
      )) {
        repository.sync_enabled = 1;
        repository.updated_at = Number(args[0]);
      }
      return;
    }

    if (sql.includes("UPDATE installations")) {
      const installation = this.installations.find((row) => row.id === String(args[2]));
      if (installation) {
        installation.sync_selection_updated_at = Number(args[0]);
        installation.updated_at = Number(args[1]);
      }
    }
  }
}

function createEnv(overrides: Partial<VibeWorkerEnv> = {}) {
  return {
    APP_URL: "https://vibe-tracker-max.vercel.app",
    DB: new FakeD1Database() as unknown as D1Database,
    GITHUB_APP_CLIENT_ID: "client-id",
    GITHUB_APP_CLIENT_SECRET: "client-secret",
    GITHUB_APP_SLUG: "vibe-tracker-rb",
    SESSION_ENCRYPTION_KEY: "session-key",
    ...overrides,
  } satisfies VibeWorkerEnv;
}

describe("GitHub repository recommendations", () => {
  beforeEach(() => {
    vi.resetModules();
    getRequestAccountIdMock.mockReset();
    getRequestAccountIdMock.mockResolvedValue("account-1");
  });

  it("includes recommended repository ids in the GitHub state payload", async () => {
    const response = await handleGitHubState(
      new Request("https://vibe-tracker-max.vercel.app/api/github/state"),
      createEnv(),
    );
    const payload = (await response.json()) as {
      installations: Array<{
        recommendedRepositoryIds: string[];
      }>;
    };

    expect(payload.installations[0]?.recommendedRepositoryIds).toEqual([
      "repo-c",
      "repo-b",
      "repo-a",
    ]);
  });

  it("applies the recommended repository set without using refresh semantics", async () => {
    const env = createEnv();
    const response = await handleGitHubInstallationRecommendedScope(
      new Request(
        "https://vibe-tracker-max.vercel.app/api/github/installations/77/scope/recommended",
        { method: "POST" },
      ),
      env,
      77,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://vibe-tracker-max.vercel.app/?github=recommended-repositories-applied",
    );

    const db = env.DB as unknown as FakeD1Database;
    expect(
      db.repositories
        .filter((repository) => repository.sync_enabled === 1)
        .map((repository) => repository.id),
    ).toEqual(["repo-a", "repo-b", "repo-c"]);
  });
});
