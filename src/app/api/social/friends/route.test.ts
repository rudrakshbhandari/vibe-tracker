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

describe("GET /api/social/friends", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchCloudflareReadJsonMock.mockReset();
    hasCloudflareWorkerProxyMock.mockReset();
  });

  it("passes the selected window to the worker", async () => {
    hasCloudflareWorkerProxyMock.mockReturnValue(true);
    fetchCloudflareReadJsonMock.mockResolvedValue({
      window: "7d",
      friends: [],
      pendingInvites: [],
    });

    const { GET } = await import("@/app/api/social/friends/route");
    const request = new NextRequest("http://localhost/api/social/friends?window=7d");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(fetchCloudflareReadJsonMock).toHaveBeenCalledWith(
      "/api/social/friends?window=7d",
    );
  });

  it("returns 400 when the window is invalid", async () => {
    const { GET } = await import("@/app/api/social/friends/route");
    const request = new NextRequest("http://localhost/api/social/friends?window=bad");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});
