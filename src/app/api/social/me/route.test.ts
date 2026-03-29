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

describe("GET /api/social/me", () => {
  beforeEach(() => {
    vi.resetModules();
    hasCloudflareWorkerProxyMock.mockReset();
    proxyCloudflareRequestMock.mockReset();
    proxyCloudflareRequestMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("proxies the request to the Cloudflare backend", async () => {
    hasCloudflareWorkerProxyMock.mockReturnValue(true);

    const { GET } = await import("@/app/api/social/me/route");
    const request = new NextRequest("http://localhost/api/social/me");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(proxyCloudflareRequestMock).toHaveBeenCalledWith(
      request,
      "/api/social/me",
    );
  });

  it("returns 503 when the Cloudflare backend is unavailable", async () => {
    hasCloudflareWorkerProxyMock.mockReturnValue(false);

    const { GET } = await import("@/app/api/social/me/route");
    const response = await GET();

    expect(response.status).toBe(503);
  });
});
