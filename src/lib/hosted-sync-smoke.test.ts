import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  dbMock,
  getInstallationRepositoriesMock,
  getPullRequestDetailMock,
  txMock,
} = vi.hoisted(() => {
  const txMock = {
    gitHubAccount: { upsert: vi.fn() },
    pullRequest: { upsert: vi.fn() },
  };

  return {
    dbMock: {
      pullRequest: { findFirst: vi.fn() },
      $transaction: vi.fn(),
    },
    getInstallationRepositoriesMock: vi.fn(),
    getPullRequestDetailMock: vi.fn(),
    txMock,
  };
});

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/github", () => ({
  getInstallationRepositories: getInstallationRepositoriesMock,
  getPullRequestDetail: getPullRequestDetailMock,
  listMergedPullRequests: vi.fn(),
}));

import { runHostedSyncSmokeTest } from "@/lib/hosted-sync-smoke";

describe("runHostedSyncSmokeTest", () => {
  beforeEach(() => {
    dbMock.pullRequest.findFirst.mockReset();
    dbMock.$transaction.mockReset();
    getInstallationRepositoriesMock.mockReset();
    getPullRequestDetailMock.mockReset();
    txMock.gitHubAccount.upsert.mockReset();
    txMock.pullRequest.upsert.mockReset();

    dbMock.pullRequest.findFirst.mockResolvedValue({
      githubPrNumber: 42,
      repositoryId: "repo-db-1",
      repository: {
        owner: "octocat",
        name: "hello-world",
        installation: {
          githubInstallId: 99,
        },
      },
    });
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
    txMock.gitHubAccount.upsert.mockResolvedValue({
      id: "account-db-2",
    });
    dbMock.$transaction.mockImplementation(async (callback) => callback(txMock));
  });

  it("writes required branch fields into the transactional smoke upsert", async () => {
    const result = await runHostedSyncSmokeTest();

    expect(txMock.pullRequest.upsert).toHaveBeenCalledWith(
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

    expect(result).toEqual({
      owner: "octocat",
      repo: "hello-world",
      pullNumber: 42,
      title: "Ship the fix",
    });
  });
});
