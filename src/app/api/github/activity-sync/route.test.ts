import type { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  canEnableHostedGitHubSyncMock,
  dbSyncJobFindFirstMock,
  failStaleActivitySyncJobsMock,
  getValidUserAccessTokenMock,
  syncUserActivityForAccountMock,
} = vi.hoisted(() => ({
  canEnableHostedGitHubSyncMock: vi.fn(),
  dbSyncJobFindFirstMock: vi.fn(),
  failStaleActivitySyncJobsMock: vi.fn(),
  getValidUserAccessTokenMock: vi.fn(),
  syncUserActivityForAccountMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getValidUserAccessToken: getValidUserAccessTokenMock,
}));

vi.mock("@/lib/env", () => ({
  canEnableHostedGitHubSync: canEnableHostedGitHubSyncMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    syncJob: {
      findFirst: dbSyncJobFindFirstMock,
    },
  },
}));

vi.mock("@/lib/activity-sync-jobs", () => ({
  failStaleActivitySyncJobs: failStaleActivitySyncJobsMock,
  getActiveActivitySyncWhere: vi.fn((installationIds: string[]) => ({
    installationId: {
      in: installationIds,
    },
    scope: "activity",
    status: {
      in: ["queued", "running"],
    },
    updatedAt: {
      gte: new Date("2026-01-01T00:00:00.000Z"),
    },
  })),
}));

vi.mock("@/lib/installation-sync", () => ({
  syncUserActivityForAccount: syncUserActivityForAccountMock,
}));

import { POST } from "@/app/api/github/activity-sync/route";

describe("POST /api/github/activity-sync", () => {
  beforeEach(() => {
    canEnableHostedGitHubSyncMock.mockReset();
    dbSyncJobFindFirstMock.mockReset();
    failStaleActivitySyncJobsMock.mockReset();
    getValidUserAccessTokenMock.mockReset();
    syncUserActivityForAccountMock.mockReset();
    canEnableHostedGitHubSyncMock.mockReturnValue(true);
    dbSyncJobFindFirstMock.mockResolvedValue(null);
    failStaleActivitySyncJobsMock.mockResolvedValue(undefined);
  });

  it("redirects unauthenticated users", async () => {
    getValidUserAccessTokenMock.mockResolvedValue(null);

    const response = await POST({
      url: "https://example.com/api/github/activity-sync",
    } as NextRequest);

    expect(response.headers.get("location")).toBe(
      "https://example.com/?github=not-connected",
    );
    expect(failStaleActivitySyncJobsMock).not.toHaveBeenCalled();
  });

  it("awaits the sync before redirecting to completed", async () => {
    getValidUserAccessTokenMock.mockResolvedValue({
      accessToken: "user-token",
      session: {
        accountId: "account-1",
        account: {
          login: "octocat",
          installationGrants: [
            {
              installation: {
                id: "installation-1",
              },
            },
          ],
        },
      },
    });

    const response = await POST({
      url: "https://example.com/api/github/activity-sync",
    } as NextRequest);

    expect(response.headers.get("location")).toBe(
      "https://example.com/?github=activity-sync-completed",
    );
    expect(failStaleActivitySyncJobsMock).toHaveBeenCalledWith(["installation-1"]);
    expect(syncUserActivityForAccountMock).toHaveBeenCalledWith({
      accountId: "account-1",
      userAccessToken: "user-token",
    });
  });

  it("does not schedule a second sync while one is already running", async () => {
    getValidUserAccessTokenMock.mockResolvedValue({
      accessToken: "user-token",
      session: {
        accountId: "account-1",
        account: {
          login: "octocat",
          installationGrants: [
            {
              installation: {
                id: "installation-1",
              },
            },
          ],
        },
      },
    });
    dbSyncJobFindFirstMock.mockResolvedValue({
      id: "sync-1",
      status: "running",
    });

    const response = await POST({
      url: "https://example.com/api/github/activity-sync",
    } as NextRequest);

    expect(response.headers.get("location")).toBe(
      "https://example.com/?github=activity-sync-running",
    );
    expect(failStaleActivitySyncJobsMock).toHaveBeenCalledWith(["installation-1"]);
    expect(syncUserActivityForAccountMock).not.toHaveBeenCalled();
  });

  it("redirects with sync-failed when the sync throws", async () => {
    getValidUserAccessTokenMock.mockResolvedValue({
      accessToken: "user-token",
      session: {
        accountId: "account-1",
        account: {
          login: "octocat",
          installationGrants: [
            {
              installation: {
                id: "installation-1",
              },
            },
          ],
        },
      },
    });
    syncUserActivityForAccountMock.mockRejectedValue(new Error("boom"));

    const response = await POST({
      url: "https://example.com/api/github/activity-sync",
    } as NextRequest);

    expect(response.headers.get("location")).toBe(
      "https://example.com/?github=sync-failed",
    );
  });
});
