import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  completeSyncJobMock,
  dbMock,
  deferSyncJobMock,
  failSyncJobMock,
  getInstallationRepositoriesMock,
  getPullRequestDetailMock,
  getUserInstallationsMock,
  listMergedPullRequestsMock,
  refreshLeaderboardSnapshotsForAccountMock,
  renewSyncJobLeaseMock,
} = vi.hoisted(() => ({
  completeSyncJobMock: vi.fn(),
  dbMock: {
    installation: { upsert: vi.fn(), findUnique: vi.fn() },
    installationGrant: { upsert: vi.fn() },
    repository: { findMany: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
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
      findFirst: vi.fn(),
    },
    gitHubAccount: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  deferSyncJobMock: vi.fn(),
  failSyncJobMock: vi.fn(),
  getInstallationRepositoriesMock: vi.fn(),
  getPullRequestDetailMock: vi.fn(),
  getUserInstallationsMock: vi.fn(),
  listMergedPullRequestsMock: vi.fn(),
  refreshLeaderboardSnapshotsForAccountMock: vi.fn(),
  renewSyncJobLeaseMock: vi.fn(),
}));

vi.mock("@/lib/activity-sync-jobs", () => ({
  MAX_TRACKED_REPOSITORIES_PER_INSTALLATION: 25,
  completeSyncJob: completeSyncJobMock,
  deferSyncJob: deferSyncJobMock,
  failSyncJob: failSyncJobMock,
  renewSyncJobLease: renewSyncJobLeaseMock,
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

import {
  enqueueActivitySyncForAccount,
  processClaimedSyncJob,
} from "@/lib/installation-sync";

describe("installation sync", () => {
  beforeEach(() => {
    completeSyncJobMock.mockReset();
    dbMock.installation.upsert.mockReset();
    dbMock.installation.findUnique.mockReset();
    dbMock.installationGrant.upsert.mockReset();
    dbMock.repository.findMany.mockReset();
    dbMock.repository.upsert.mockReset();
    dbMock.repository.updateMany.mockReset();
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
    dbMock.syncJob.findFirst.mockReset();
    dbMock.gitHubAccount.upsert.mockReset();
    dbMock.$transaction.mockReset();
    deferSyncJobMock.mockReset();
    failSyncJobMock.mockReset();
    getInstallationRepositoriesMock.mockReset();
    getPullRequestDetailMock.mockReset();
    getUserInstallationsMock.mockReset();
    listMergedPullRequestsMock.mockReset();
    refreshLeaderboardSnapshotsForAccountMock.mockReset();
    renewSyncJobLeaseMock.mockReset();

    dbMock.installation.upsert.mockResolvedValue({
      id: "installation-db-1",
      githubInstallId: 99,
      accountLogin: "octocat",
    });
    dbMock.installationGrant.upsert.mockResolvedValue({});
    dbMock.repository.upsert.mockResolvedValue({});
    dbMock.$transaction.mockResolvedValue([]);
    dbMock.syncJob.findFirst.mockResolvedValue(null);
    dbMock.syncJob.create.mockResolvedValue({
      id: "job-1",
      installationId: "installation-db-1",
    });
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
    refreshLeaderboardSnapshotsForAccountMock.mockResolvedValue(undefined);
    completeSyncJobMock.mockResolvedValue(undefined);
    deferSyncJobMock.mockResolvedValue(undefined);
    failSyncJobMock.mockResolvedValue(undefined);
    renewSyncJobLeaseMock.mockResolvedValue(undefined);
  });

  it("queues activity sync jobs using the tracked repository cap", async () => {
    const githubRepositories = Array.from({ length: 26 }, (_, index) => ({
      id: index + 1,
      name: `repo-${index + 1}`,
      full_name: `octocat/repo-${index + 1}`,
      private: false,
      default_branch: "main",
      owner: {
        login: "octocat",
      },
    }));

    getInstallationRepositoriesMock.mockResolvedValue(githubRepositories);
    dbMock.repository.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        githubRepositories.map((repository, index) => ({
          id: `repo-db-${index + 1}`,
          owner: "octocat",
          name: repository.name,
          syncEnabled: index < 25,
        })),
      );

    await enqueueActivitySyncForAccount({
      accountId: "account-db-1",
      userAccessToken: "user-token",
    });

    expect(dbMock.repository.upsert).toHaveBeenCalledTimes(26);
    expect(dbMock.repository.upsert.mock.calls[25]?.[0]).toEqual(
      expect.objectContaining({
        create: expect.objectContaining({
          syncEnabled: false,
        }),
      }),
    );
    expect(dbMock.syncJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "account-db-1",
          installationId: "installation-db-1",
          scope: "activity",
          status: "queued",
          resultJson: expect.any(String),
        }),
      }),
    );

    const queuedPayload = JSON.parse(
      dbMock.syncJob.create.mock.calls[0]?.[0].data.resultJson as string,
    );
    expect(queuedPayload).toEqual(
      expect.objectContaining({
        selectedRepositoryCount: 25,
        skippedRepositoryCount: 1,
      }),
    );
  });

  it("processes a claimed activity job and enqueues leaderboard refresh separately", async () => {
    dbMock.installation.findUnique.mockResolvedValue({
      id: "installation-db-1",
      githubInstallId: 99,
      repositories: [
        {
          id: "repo-db-1",
          owner: "octocat",
          name: "hello-world",
          syncEnabled: true,
        },
      ],
    });
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
      base: {
        ref: "main",
      },
      head: {
        ref: "feature/ship-the-fix",
      },
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

    await processClaimedSyncJob({
      job: {
        id: "job-1",
        accountId: "account-db-1",
        installationId: "installation-db-1",
        scope: "activity",
        createdAt: new Date("2026-03-21T00:00:00.000Z"),
        startedAt: new Date("2026-03-21T00:00:05.000Z"),
        attemptCount: 1,
        maxAttempts: 3,
      } as never,
      leaseToken: "lease-1",
    });

    expect(dbMock.pullRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          baseBranch: "main",
          headBranch: "feature/ship-the-fix",
          title: "Ship the fix",
        }),
        update: expect.objectContaining({
          baseBranch: "main",
          headBranch: "feature/ship-the-fix",
          title: "Ship the fix",
        }),
      }),
    );
    expect(completeSyncJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        leaseToken: "lease-1",
        result: expect.objectContaining({
          selectedRepositoryCount: 1,
          syncedRepositoryCount: 1,
          processedPullRequestCount: 1,
        }),
      }),
    );
    expect(dbMock.syncJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "account-db-1",
          installationId: "installation-db-1",
          scope: "leaderboard",
          status: "queued",
        }),
      }),
    );
    expect(refreshLeaderboardSnapshotsForAccountMock).not.toHaveBeenCalled();
  });
});
