import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { runHostedSyncSmokeTestMock } = vi.hoisted(() => ({
  runHostedSyncSmokeTestMock: vi.fn(),
}));

vi.mock("@/lib/hosted-sync-smoke", () => ({
  runHostedSyncSmokeTest: runHostedSyncSmokeTestMock,
}));

import { GET } from "@/app/api/smoke/github-sync/route";

describe("GET /api/smoke/github-sync", () => {
  beforeEach(() => {
    runHostedSyncSmokeTestMock.mockReset();
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
});
