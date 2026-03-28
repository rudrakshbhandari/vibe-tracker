import type { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { proxyCloudflareRequestMock } = vi.hoisted(() => ({
  proxyCloudflareRequestMock: vi.fn(),
}));

vi.mock("@/lib/cloudflare-read", () => ({
  proxyCloudflareRequest: proxyCloudflareRequestMock,
}));

describe("GET /api/github/connect", () => {
  beforeEach(() => {
    vi.resetModules();
    proxyCloudflareRequestMock.mockReset();
    proxyCloudflareRequestMock.mockResolvedValue(new Response(null, { status: 302 }));
  });

  it("proxies the connect flow to the Cloudflare worker", async () => {
    const { GET } = await import("@/app/api/github/connect/route");
    const request = {
      url: "https://vibe-tracker-max.vercel.app/api/github/connect",
    } as NextRequest;

    await GET(request);

    expect(proxyCloudflareRequestMock).toHaveBeenCalledWith(
      request,
      "/api/github/connect",
    );
  });
});
