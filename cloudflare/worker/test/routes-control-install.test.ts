import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleGitHubInstall } from "@/routes/control";
import type { VibeWorkerEnv } from "@/env";

const { getValidUserAccessTokenMock, getUserInstallationsMock } = vi.hoisted(() => ({
  getValidUserAccessTokenMock: vi.fn(),
  getUserInstallationsMock: vi.fn(),
}));

vi.mock("@/lib/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/session")>("@/lib/session");
  return {
    ...actual,
    getValidUserAccessToken: getValidUserAccessTokenMock,
  };
});

vi.mock("@/lib/github", async () => {
  const actual = await vi.importActual<typeof import("@/lib/github")>("@/lib/github");
  return {
    ...actual,
    getUserInstallations: getUserInstallationsMock,
  };
});

function createEnv(overrides: Partial<VibeWorkerEnv> = {}) {
  return {
    APP_URL: "https://vibe-tracker-max.vercel.app",
    DB: {} as D1Database,
    GITHUB_APP_CLIENT_ID: "client-id",
    GITHUB_APP_CLIENT_SECRET: "client-secret",
    GITHUB_APP_SLUG: "vibe-tracker-rb",
    SESSION_ENCRYPTION_KEY: "session-key",
    SYNC_QUEUE: {
      send: vi.fn().mockResolvedValue(undefined),
    } as unknown as Queue,
    ...overrides,
  } satisfies VibeWorkerEnv;
}

describe("handleGitHubInstall", () => {
  beforeEach(() => {
    vi.resetModules();
    getValidUserAccessTokenMock.mockReset();
    getUserInstallationsMock.mockReset();
  });

  it("queues existing installations for signed-in users instead of bouncing back to GitHub", async () => {
    const env = createEnv();
    getValidUserAccessTokenMock.mockResolvedValue({
      accountId: "account-1",
      accessToken: "access-token",
    });
    getUserInstallationsMock.mockResolvedValue([
      {
        id: 115689046,
        account: {
          login: "rudrakshbhandari",
          type: "User",
        },
        target_type: "user",
        permissions: {
          contents: "read",
        },
      },
    ]);

    const response = await handleGitHubInstall(
      new Request("https://vibe-tracker-max.vercel.app/api/github/install"),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://vibe-tracker-max.vercel.app/?github=installation-connected",
    );
    expect(env.SYNC_QUEUE.send).toHaveBeenCalledTimes(1);
  });

  it("falls back to the GitHub install page when no session exists", async () => {
    const env = createEnv();
    getValidUserAccessTokenMock.mockResolvedValue(null);

    const response = await handleGitHubInstall(
      new Request("https://vibe-tracker-max.vercel.app/api/github/install"),
      env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://github.com/apps/vibe-tracker-rb/installations/new",
    );
  });
});
