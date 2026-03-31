import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { runHostedSyncSmokeTestMock, runWorkerReadSmokeTestMock } = vi.hoisted(() => ({
  runHostedSyncSmokeTestMock: vi.fn(),
  runWorkerReadSmokeTestMock: vi.fn(),
}));

vi.mock("@/lib/hosted-sync-smoke", () => ({
  runHostedSyncSmokeTest: runHostedSyncSmokeTestMock,
}));

vi.mock("@/lib/worker-read-smoke", () => ({
  runWorkerReadSmokeTest: runWorkerReadSmokeTestMock,
}));

import { GET } from "@/app/api/smoke/github-sync/route";

describe("GET /api/smoke/github-sync", () => {
  beforeEach(() => {
    runHostedSyncSmokeTestMock.mockReset();
    runWorkerReadSmokeTestMock.mockReset();
    process.env.SMOKE_TEST_SECRET = "smoke-secret";
  });

  it("returns 401 without the smoke auth header", async () => {
    const response = await GET(
      new NextRequest("https://example.com/api/smoke/github-sync"),
    );

    expect(response.status).toBe(401);
  });

  it("returns the smoke result for an authorized request", async () => {
    runHostedSyncSmokeTestMock.mockResolvedValue({
      owner: "octocat",
      repo: "hello-world",
      pullNumber: 42,
      title: "Ship the fix",
    });

    const response = await GET(
      new NextRequest("https://example.com/api/smoke/github-sync", {
        headers: {
          authorization: "Bearer smoke-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: {
        owner: "octocat",
        repo: "hello-world",
        pullNumber: 42,
        title: "Ship the fix",
      },
    });
  });

  it("returns 500 when the smoke test fails", async () => {
    runHostedSyncSmokeTestMock.mockRejectedValue(new Error("boom"));

    const response = await GET(
      new NextRequest("https://example.com/api/smoke/github-sync", {
        headers: {
          authorization: "Bearer smoke-secret",
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "boom",
    });
  });

  it("runs the worker-read smoke path when a login is provided", async () => {
    runWorkerReadSmokeTestMock.mockResolvedValue({
      login: "rudrakshbhandari",
      installationCount: 1,
      trackedRepositoryCount: 25,
      accessibleRepositoryCount: 33,
      summaryCount: 4,
      timelineCount: 14,
      repositoryCount: 5,
      chartTitle: "Daily shipped work",
      user: "@rudrakshbhandari",
    });

    const response = await GET(
      new NextRequest("https://example.com/api/smoke/github-sync?login=rudrakshbhandari", {
        headers: {
          authorization: "Bearer smoke-secret",
        },
      }),
    );

    expect(runHostedSyncSmokeTestMock).not.toHaveBeenCalled();
    expect(runWorkerReadSmokeTestMock).toHaveBeenCalledWith("rudrakshbhandari");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: {
        login: "rudrakshbhandari",
        installationCount: 1,
        trackedRepositoryCount: 25,
        accessibleRepositoryCount: 33,
        summaryCount: 4,
        timelineCount: 14,
        repositoryCount: 5,
        chartTitle: "Daily shipped work",
        user: "@rudrakshbhandari",
      },
    });
  });
});
