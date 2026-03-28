import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { proxyCloudflareRequestMock } = vi.hoisted(() => ({
  proxyCloudflareRequestMock: vi.fn(),
}));

vi.mock("@/lib/cloudflare-read", () => ({
  proxyCloudflareRequest: proxyCloudflareRequestMock,
}));

describe("POST /api/github/activity-sync", () => {
  beforeEach(() => {
    vi.resetModules();
    proxyCloudflareRequestMock.mockReset();
    proxyCloudflareRequestMock.mockResolvedValue(new Response(null, { status: 302 }));
  });

  it("proxies the sync request to the Cloudflare worker", async () => {
    const { POST } = await import("@/app/api/github/activity-sync/route");
    const request = new NextRequest("https://example.com/api/github/activity-sync", {
      method: "POST",
    });

    await POST(request);

    expect(proxyCloudflareRequestMock).toHaveBeenCalledWith(
      request,
      "/api/github/activity-sync",
    );
  });
});
