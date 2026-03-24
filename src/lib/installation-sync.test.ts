import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  getInstallationRepositoriesMock,
  getPullRequestDetailMock,
  getUserInstallationsMock,
  listMergedPullRequestsMock,
  refreshLeaderboardSnapshotsForAccountMock,
} = vi.hoisted(() => ({
  dbMock: {
    installation: { upsert: vi.fn() },
    installationGrant: { upsert: vi.fn() },
    repository: { findMany: vi.fn(), upsert: vi.fn() },
    dailyUserRepoStats: {
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    pullRequest: {
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    syncCursor: {
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    syncJob: {
      create: vi.fn(),
      update: vi.fn(),
    },
    gitHubAccount: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  getInstallationRepositoriesMock: vi.fn(),
  getPullRequestDetailMock: vi.fn(),
  getUserInstallationsMock: vi.fn(),
  listMergedPullRequestsMock: vi.fn(),
  refreshLeaderboardSnapshotsForAccountMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/github", () => ({
  getInstallationRepositories: getInstallationRepositoriesMock,
  getPullRequestDetail: getPullRequestDetailMock,
  getUserInstallations: getUserInstallationsMock,
  listMergedPullRequests: listMergedPullRequestsMock,
}));

vi.mock("@/lib/repository-sync", () => ({
  getStaleRepositoryIds: vi.fn(() => []),
}));

vi.mock("@/lib/social", () => ({
  refreshLeaderboardSnapshotsForAccount: refreshLeaderboardSnapshotsForAccountMock,
}));

import { syncUserActivityForAccount } from "@/lib/installation-sync";

describe("installation sync", () => {
  beforeEach(() => {
    dbMock.installation.upsert.mockReset();
    dbMock.installationGrant.upsert.mockReset();
    dbMock.repository.findMany.mockReset();
    dbMock.repository.upsert.mockReset();
    dbMock.dailyUserRepoStats.deleteMany.mockReset();
    dbMock.dailyUserRepoStats.findUnique.mockReset();
    dbMock.dailyUserRepoStats.delete.mockReset();
    dbMock.dailyUserRepoStats.upsert.mockReset();
    dbMock.pullRequest.deleteMany.mockReset();
    dbMock.pullRequest.findUnique.mockReset();
    dbMock.pullRequest.upsert.mockReset();
    dbMock.syncCursor.deleteMany.mockReset();
    dbMock.syncCursor.findUnique.mockReset();
    dbMock.syncCursor.upsert.mockReset();
    dbMock.syncJob.create.mockReset();
    dbMock.syncJob.update.mockReset();
    dbMock.gitHubAccount.upsert.mockReset();
    dbMock.$transaction.mockReset();
    getInstallationRepositoriesMock.mockReset();
    getPullRequestDetailMock.mockReset();
    getUserInstallationsMock.mockReset();
    listMergedPullRequestsMock.mockReset();
    refreshLeaderboardSnapshotsForAccountMock.mockReset();

    dbMock.installation.upsert.mockResolvedValue({
      id: "installation-db-1",
      githubInstallId: 99,
      accountLogin: "octocat",
    });
    dbMock.installationGrant.upsert.mockResolvedValue({});
    dbMock.repository.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "repo-db-1",
          owner: "octocat",
          name: "hello-world",
        },
      ]);
    dbMock.repository.upsert.mockResolvedValue({});
    dbMock.$transaction.mockResolvedValue([]);
    dbMock.syncJob.create.mockResolvedValue({
      id: "job-1",
      installationId: "installation-db-1",
    });
    dbMock.syncJob.update.mockResolvedValue({});
    dbMock.syncCursor.findUnique.mockResolvedValue(null);
    dbMock.syncCursor.upsert.mockResolvedValue({});
    dbMock.pullRequest.findUnique.mockResolvedValue(null);
    dbMock.pullRequest.upsert.mockImplementation(
      async ({
        create,
        update,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => ({
        id: "pr-db-1",
        ...(create ?? update),
      }),
    );
    dbMock.dailyUserRepoStats.findUnique.mockResolvedValue(null);
    dbMock.dailyUserRepoStats.upsert.mockResolvedValue({});
    dbMock.gitHubAccount.upsert.mockResolvedValue({
      id: "account-db-2",
    });
    getUserInstallationsMock.mockResolvedValue([
      {
        id: 99,
        account: {
          login: "octocat",
          type: "User",
        },
        permissions: {
          metadata: "read",
          pull_requests: "read",
        },
      },
    ]);
    getInstallationRepositoriesMock.mockResolvedValue([
      {
        id: 123,
        name: "hello-world",
        full_name: "octocat/hello-world",
        private: false,
        default_branch: "main",
        owner: {
          login: "octocat",
        },
      },
    ]);
    listMergedPullRequestsMock.mockResolvedValue([
      {
        number: 42,
        state: "closed",
        title: "Ship the fix",
        user: {
          id: 77,
          login: "octocat",
          avatar_url: "https://avatars.githubusercontent.com/u/77",
        },
        created_at: "2026-03-20T00:00:00.000Z",
        updated_at: "2026-03-21T00:00:00.000Z",
        merged_at: "2026-03-21T00:00:00.000Z",
      },
    ]);
    getPullRequestDetailMock.mockResolvedValue({
      number: 42,
      state: "closed",
      title: "Ship the fix",
      user: {
        id: 77,
        login: "octocat",
        avatar_url: "https://avatars.githubusercontent.com/u/77",
      },
      created_at: "2026-03-20T00:00:00.000Z",
      updated_at: "2026-03-21T00:00:00.000Z",
      merged_at: "2026-03-21T00:00:00.000Z",
      additions: 12,
      deletions: 4,
      commits: 3,
    });
    refreshLeaderboardSnapshotsForAccountMock.mockResolvedValue(undefined);
  });

  it("persists pull request titles during activity sync", async () => {
    await syncUserActivityForAccount({
      accountId: "account-db-1",
      userAccessToken: "user-token",
    });

    expect(dbMock.pullRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          title: "Ship the fix",
        }),
        update: expect.objectContaining({
          title: "Ship the fix",
        }),
      }),
    );
  });
});
