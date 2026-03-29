import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { proxyCloudflareRequestMock } = vi.hoisted(() => ({
  proxyCloudflareRequestMock: vi.fn(),
}));

vi.mock("@/lib/cloudflare-read", () => ({
  proxyCloudflareRequest: proxyCloudflareRequestMock,
}));

describe("POST /api/github/installations/[installationId]/scope/recommended", () => {
  beforeEach(() => {
    vi.resetModules();
    proxyCloudflareRequestMock.mockReset();
    proxyCloudflareRequestMock.mockResolvedValue(new Response(null, { status: 302 }));
  });

  it("proxies recommended scope updates to the Cloudflare worker", async () => {
    const { POST } = await import(
      "@/app/api/github/installations/[installationId]/scope/recommended/route"
    );
    const request = new NextRequest(
      "https://example.com/api/github/installations/12/scope/recommended",
      {
        method: "POST",
      },
    );

    await POST(request, {
      params: Promise.resolve({
        installationId: "12",
      }),
    });

    expect(proxyCloudflareRequestMock).toHaveBeenCalledWith(
      request,
      "/api/github/installations/12/scope/recommended",
    );
  });
});
