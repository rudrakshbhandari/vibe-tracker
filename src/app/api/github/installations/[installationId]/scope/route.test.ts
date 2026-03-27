import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  canEnableHostedGitHubSyncMock,
  getValidUserAccessTokenMock,
  updateTrackedRepositoriesForInstallationMock,
} = vi.hoisted(() => ({
  canEnableHostedGitHubSyncMock: vi.fn(),
  getValidUserAccessTokenMock: vi.fn(),
  updateTrackedRepositoriesForInstallationMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  canEnableHostedGitHubSync: canEnableHostedGitHubSyncMock,
}));

vi.mock("@/lib/activity-sync-jobs", () => ({
  MAX_TRACKED_REPOSITORIES_PER_INSTALLATION: 25,
}));

vi.mock("@/lib/session", () => ({
  getValidUserAccessToken: getValidUserAccessTokenMock,
}));

vi.mock("@/lib/installation-sync", () => ({
  updateTrackedRepositoriesForInstallation: updateTrackedRepositoriesForInstallationMock,
}));

import { POST } from "@/app/api/github/installations/[installationId]/scope/route";

describe("POST /api/github/installations/[installationId]/scope", () => {
  beforeEach(() => {
    canEnableHostedGitHubSyncMock.mockReset();
    getValidUserAccessTokenMock.mockReset();
    updateTrackedRepositoriesForInstallationMock.mockReset();
    canEnableHostedGitHubSyncMock.mockReturnValue(true);
  });

  it("redirects when the user is not connected", async () => {
    getValidUserAccessTokenMock.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("https://example.com/api/github/installations/12/scope", {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          installationId: "12",
        }),
      },
    );

    expect(response.headers.get("location")).toBe(
      "https://example.com/?github=not-connected",
    );
  });

  it("saves the selected tracked repositories", async () => {
    getValidUserAccessTokenMock.mockResolvedValue({
      session: {
        accountId: "account-1",
        account: {
          installationGrants: [
            {
              installation: {
                id: "installation-db-1",
                githubInstallId: 12,
              },
            },
          ],
        },
      },
    });

    const request = new NextRequest(
      "https://example.com/api/github/installations/12/scope",
      {
        method: "POST",
        body: new URLSearchParams([
          ["repositoryIds", "repo-1"],
          ["repositoryIds", "repo-2"],
        ]),
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({
        installationId: "12",
      }),
    });

    expect(updateTrackedRepositoriesForInstallationMock).toHaveBeenCalledWith({
      installationId: "installation-db-1",
      repositoryIds: ["repo-1", "repo-2"],
    });
    expect(response.headers.get("location")).toBe(
      "https://example.com/?github=repository-scope-saved",
    );
  });
});
