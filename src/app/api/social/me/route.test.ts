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

describe("GET /api/social/me", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchCloudflareReadJsonMock.mockReset();
    hasCloudflareWorkerProxyMock.mockReset();
  });

  it("returns worker payload when the Cloudflare backend responds", async () => {
    hasCloudflareWorkerProxyMock.mockReturnValue(true);
    fetchCloudflareReadJsonMock.mockResolvedValue({
      profile: { login: "octocat" },
    });

    const { GET } = await import("@/app/api/social/me/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      profile: { login: "octocat" },
    });
  });

  it("returns 503 when the Cloudflare backend is unavailable", async () => {
    hasCloudflareWorkerProxyMock.mockReturnValue(false);

    const { GET } = await import("@/app/api/social/me/route");
    const response = await GET();

    expect(response.status).toBe(503);
  });
});
