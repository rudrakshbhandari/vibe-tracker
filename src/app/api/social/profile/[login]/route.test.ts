import { NextRequest } from "next/server";

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

describe("GET /api/social/profile/[login]", () => {
  beforeEach(() => {
    vi.resetModules();
    hasCloudflareWorkerProxyMock.mockReset();
    proxyCloudflareRequestMock.mockReset();
    proxyCloudflareRequestMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("proxies the worker-backed profile request", async () => {
    hasCloudflareWorkerProxyMock.mockReturnValue(true);

    const { GET } = await import("@/app/api/social/profile/[login]/route");
    const request = new NextRequest("http://localhost/api/social/profile/public-user");
    const response = await GET(request, {
      params: Promise.resolve({ login: "public-user" }),
    });

    expect(response.status).toBe(200);
    expect(proxyCloudflareRequestMock).toHaveBeenCalledWith(
      request,
      "/api/social/profile/public-user",
    );
  });

  it("returns 503 when the worker path is unavailable", async () => {
    hasCloudflareWorkerProxyMock.mockReturnValue(false);

    const { GET } = await import("@/app/api/social/profile/[login]/route");
    const response = await GET(new NextRequest("http://localhost"), {
      params: Promise.resolve({ login: "public-user" }),
    });

    expect(response.status).toBe(503);
  });
});
