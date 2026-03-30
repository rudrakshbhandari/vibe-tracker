import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { proxyCloudflareRequestMock } = vi.hoisted(() => ({
  proxyCloudflareRequestMock: vi.fn(),
}));

vi.mock("@/lib/cloudflare-read", () => ({
  proxyCloudflareRequest: proxyCloudflareRequestMock,
}));

describe("GET /api/github/state", () => {
  beforeEach(() => {
    vi.resetModules();
    proxyCloudflareRequestMock.mockReset();
    proxyCloudflareRequestMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("proxies github state reads to the Cloudflare worker", async () => {
    const { GET } = await import("@/app/api/github/state/route");
    const request = new NextRequest("https://example.com/api/github/state");

    await GET(request);

    expect(proxyCloudflareRequestMock).toHaveBeenCalledWith(
      request,
      "/api/github/state",
    );
  });
});
