import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { proxyCloudflareRequestMock } = vi.hoisted(() => ({
  proxyCloudflareRequestMock: vi.fn(),
}));

vi.mock("@/lib/cloudflare-read", () => ({
  proxyCloudflareRequest: proxyCloudflareRequestMock,
}));

describe("PATCH /api/social/profile", () => {
  beforeEach(() => {
    vi.resetModules();
    proxyCloudflareRequestMock.mockReset();
    proxyCloudflareRequestMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("proxies profile updates to the worker", async () => {
    const { PATCH } = await import("@/app/api/social/profile/route");
    const request = new NextRequest("http://localhost/api/social/profile", {
      method: "PATCH",
      body: JSON.stringify({
        bio: "Ships code",
        profileVisibility: "PUBLIC",
        leaderboardVisibility: "PUBLIC",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    await PATCH(request);

    expect(proxyCloudflareRequestMock).toHaveBeenCalledWith(
      request,
      "/api/social/profile",
    );
  });
});
