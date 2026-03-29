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

vi.mock("@/lib/metrics", () => ({
  metricsQuerySchema: z.object({
    view: z.enum(["daily", "weekly", "monthly"]).default("daily"),
    mode: z.enum(["shipped", "merged"]).default("shipped"),
  }),
}));

describe("GET /api/metrics", () => {
  beforeEach(() => {
    vi.resetModules();
    hasCloudflareWorkerProxyMock.mockReset();
    proxyCloudflareRequestMock.mockReset();
    proxyCloudflareRequestMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("proxies the validated query string through to the worker", async () => {
    hasCloudflareWorkerProxyMock.mockReturnValue(true);

    const { GET } = await import("@/app/api/metrics/route");
    const request = new NextRequest(
      "http://localhost/api/metrics?view=weekly&mode=shipped",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(proxyCloudflareRequestMock).toHaveBeenCalledWith(
      request,
      "/api/metrics?view=weekly&mode=shipped",
    );
  });

  it("returns 400 when the query params are invalid", async () => {
    const { GET } = await import("@/app/api/metrics/route");
    const request = new NextRequest("http://localhost/api/metrics?view=oops");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});
