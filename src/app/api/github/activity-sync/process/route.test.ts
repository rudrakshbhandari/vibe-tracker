import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  canEnableHostedGitHubSyncMock,
  claimNextSyncJobForAccountMock,
  getValidUserAccessTokenMock,
  processClaimedSyncJobMock,
} = vi.hoisted(() => ({
  canEnableHostedGitHubSyncMock: vi.fn(),
  claimNextSyncJobForAccountMock: vi.fn(),
  getValidUserAccessTokenMock: vi.fn(),
  processClaimedSyncJobMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  canEnableHostedGitHubSync: canEnableHostedGitHubSyncMock,
}));

vi.mock("@/lib/activity-sync-jobs", () => ({
  claimNextSyncJobForAccount: claimNextSyncJobForAccountMock,
}));

vi.mock("@/lib/session", () => ({
  getValidUserAccessToken: getValidUserAccessTokenMock,
}));

vi.mock("@/lib/installation-sync", () => ({
  processClaimedSyncJob: processClaimedSyncJobMock,
}));

import { POST } from "@/app/api/github/activity-sync/process/route";

describe("POST /api/github/activity-sync/process", () => {
  beforeEach(() => {
    canEnableHostedGitHubSyncMock.mockReset();
    claimNextSyncJobForAccountMock.mockReset();
    getValidUserAccessTokenMock.mockReset();
    processClaimedSyncJobMock.mockReset();
    canEnableHostedGitHubSyncMock.mockReturnValue(true);
  });

  it("returns 401 when the session is missing", async () => {
    getValidUserAccessTokenMock.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ status: "unauthorized" });
  });

  it("returns idle when there is nothing queued", async () => {
    getValidUserAccessTokenMock.mockResolvedValue({
      session: {
        accountId: "account-1",
      },
    });
    claimNextSyncJobForAccountMock.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "idle" });
  });

  it("claims and processes the next queued job", async () => {
    getValidUserAccessTokenMock.mockResolvedValue({
      session: {
        accountId: "account-1",
      },
    });
    claimNextSyncJobForAccountMock.mockResolvedValue({
      job: {
        id: "job-1",
        scope: "activity",
      },
      leaseToken: "lease-1",
    });
    processClaimedSyncJobMock.mockResolvedValue({
      status: "completed",
    });

    const response = await POST();

    expect(claimNextSyncJobForAccountMock).toHaveBeenCalledWith("account-1");
    expect(processClaimedSyncJobMock).toHaveBeenCalledWith({
      job: {
        id: "job-1",
        scope: "activity",
      },
      leaseToken: "lease-1",
    });
    await expect(response.json()).resolves.toEqual({
      status: "completed",
      scope: "activity",
      jobId: "job-1",
    });
  });
});
