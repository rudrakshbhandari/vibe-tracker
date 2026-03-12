import type { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  afterMock,
  getValidUserAccessTokenMock,
  syncUserActivityForAccountMock,
} = vi.hoisted(() => ({
  afterMock: vi.fn(),
  getValidUserAccessTokenMock: vi.fn(),
  syncUserActivityForAccountMock: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");

  return {
    ...actual,
    after: afterMock,
  };
});

vi.mock("@/lib/session", () => ({
  getValidUserAccessToken: getValidUserAccessTokenMock,
}));

vi.mock("@/lib/installation-sync", () => ({
  syncUserActivityForAccount: syncUserActivityForAccountMock,
}));

import { POST } from "@/app/api/github/activity-sync/route";

describe("POST /api/github/activity-sync", () => {
  beforeEach(() => {
    afterMock.mockReset();
    getValidUserAccessTokenMock.mockReset();
    syncUserActivityForAccountMock.mockReset();
  });

  it("redirects unauthenticated users", async () => {
    getValidUserAccessTokenMock.mockResolvedValue(null);

    const response = await POST({
      url: "https://example.com/api/github/activity-sync",
    } as NextRequest);

    expect(response.headers.get("location")).toBe(
      "https://example.com/?github=not-connected",
    );
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("schedules the sync after the response instead of awaiting it", async () => {
    const scheduledTasks: Array<() => Promise<void>> = [];

    getValidUserAccessTokenMock.mockResolvedValue({
      accessToken: "user-token",
      session: {
        accountId: "account-1",
        account: {
          login: "octocat",
        },
      },
    });
    afterMock.mockImplementation((task: () => Promise<void>) => {
      scheduledTasks.push(task);
    });

    const response = await POST({
      url: "https://example.com/api/github/activity-sync",
    } as NextRequest);

    expect(response.headers.get("location")).toBe(
      "https://example.com/?github=activity-sync-started",
    );
    expect(afterMock).toHaveBeenCalledOnce();
    expect(syncUserActivityForAccountMock).not.toHaveBeenCalled();

    await scheduledTasks[0]?.();

    expect(syncUserActivityForAccountMock).toHaveBeenCalledWith({
      accountId: "account-1",
      authorLogin: "octocat",
      userAccessToken: "user-token",
    });
  });
});
