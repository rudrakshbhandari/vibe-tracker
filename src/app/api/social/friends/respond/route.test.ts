import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { proxyCloudflareRequestMock } = vi.hoisted(() => ({
  proxyCloudflareRequestMock: vi.fn(),
}));

vi.mock("@/lib/cloudflare-read", () => ({
  proxyCloudflareRequest: proxyCloudflareRequestMock,
}));

describe("POST /api/social/friends/respond", () => {
  beforeEach(() => {
    vi.resetModules();
    proxyCloudflareRequestMock.mockReset();
    proxyCloudflareRequestMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("proxies invite responses to the worker", async () => {
    const { POST } = await import("@/app/api/social/friends/respond/route");
    const request = new NextRequest("http://localhost/api/social/friends/respond", {
      method: "POST",
      body: JSON.stringify({
        token: "invite-token",
        action: "accept",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    await POST(request);

    expect(proxyCloudflareRequestMock).toHaveBeenCalledWith(
      request,
      "/api/social/friends/respond",
    );
  });
});
