import { NextRequest } from "next/server";
import { z } from "zod";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  hasCloudflareWorkerProxyMock,
  proxyCloudflareRequestMock,
} = vi.hoisted(() => ({
  hasCloudflareWorkerProxyMock: vi.fn(),
  proxyCloudflareRequestMock: vi.fn(),
}));

vi.mock("@/lib/cloudflare-read", () => ({
  hasCloudflareWorkerProxy: hasCloudflareWorkerProxyMock,
  proxyCloudflareRequest: proxyCloudflareRequestMock,
}));

vi.mock("@/lib/social", () => ({
  socialScopeSchema: z.enum(["friends", "global"]),
  socialWindowSchema: z.enum(["7d", "30d", "90d"]),
}));

describe("GET /api/social/leaderboard", () => {
  beforeEach(() => {
    vi.resetModules();
    hasCloudflareWorkerProxyMock.mockReset();
    proxyCloudflareRequestMock.mockReset();
    proxyCloudflareRequestMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("passes scope and window through to the worker", async () => {
    hasCloudflareWorkerProxyMock.mockReturnValue(true);

    const { GET } = await import("@/app/api/social/leaderboard/route");
    const request = new NextRequest(
      "http://localhost/api/social/leaderboard?scope=global&window=90d",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(proxyCloudflareRequestMock).toHaveBeenCalledWith(
      request,
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
