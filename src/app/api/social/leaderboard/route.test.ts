import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchCloudflareReadJsonMock,
  hasCloudflareWorkerProxyMock,
} = vi.hoisted(() => ({
  fetchCloudflareReadJsonMock: vi.fn(),
  hasCloudflareWorkerProxyMock: vi.fn(),
}));

vi.mock("@/lib/cloudflare-read", () => ({
  fetchCloudflareReadJson: fetchCloudflareReadJsonMock,
  hasCloudflareWorkerProxy: hasCloudflareWorkerProxyMock,
}));

describe("GET /api/social/leaderboard", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchCloudflareReadJsonMock.mockReset();
    hasCloudflareWorkerProxyMock.mockReset();
  });

  it("passes scope and window through to the worker", async () => {
    hasCloudflareWorkerProxyMock.mockReturnValue(true);
    fetchCloudflareReadJsonMock.mockResolvedValue({
      scope: "global",
      window: "90d",
      entries: [],
    });

    const { GET } = await import("@/app/api/social/leaderboard/route");
    const request = new NextRequest(
      "http://localhost/api/social/leaderboard?scope=global&window=90d",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(fetchCloudflareReadJsonMock).toHaveBeenCalledWith(
      "/api/social/leaderboard?scope=global&window=90d",
    );
  });

  it("returns 400 when query params are invalid", async () => {
    const { GET } = await import("@/app/api/social/leaderboard/route");
    const request = new NextRequest(
      "http://localhost/api/social/leaderboard?scope=oops",
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});
