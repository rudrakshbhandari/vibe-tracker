import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchCloudflareReadJsonMock,
  hasCloudflareWorkerProxyMock,
} = vi.hoisted(() => ({
  fetchCloudflareReadJsonMock: vi.fn(),
  hasCloudflareWorkerProxyMock: vi.fn(),
}));

vi.mock("@/lib/cloudflare-read", () => ({
  fetchCloudflareReadJson: fetchCloudflareReadJsonMock,
  hasCloudflareWorkerProxy: hasCloudflareWorkerProxyMock,
}));

describe("GET /api/social/profile/[login]", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchCloudflareReadJsonMock.mockReset();
    hasCloudflareWorkerProxyMock.mockReset();
  });

  it("returns the worker-backed profile payload", async () => {
    hasCloudflareWorkerProxyMock.mockReturnValue(true);
    fetchCloudflareReadJsonMock.mockResolvedValue({
      login: "public-user",
    });

    const { GET } = await import("@/app/api/social/profile/[login]/route");
    const response = await GET(new NextRequest("http://localhost"), {
      params: Promise.resolve({ login: "public-user" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      login: "public-user",
    });
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
