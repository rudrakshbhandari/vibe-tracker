import type { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { proxyCloudflareRequestMock } = vi.hoisted(() => ({
  proxyCloudflareRequestMock: vi.fn(),
}));
const { handleLocalGitHubConnectMock, shouldUseLocalGitHubAuthMock } = vi.hoisted(() => ({
  handleLocalGitHubConnectMock: vi.fn(),
  shouldUseLocalGitHubAuthMock: vi.fn(),
}));

vi.mock("@/lib/cloudflare-read", () => ({
  proxyCloudflareRequest: proxyCloudflareRequestMock,
}));
vi.mock("@/lib/github-auth-local", () => ({
  handleLocalGitHubConnect: handleLocalGitHubConnectMock,
  shouldUseLocalGitHubAuth: shouldUseLocalGitHubAuthMock,
}));

describe("GET /api/github/connect", () => {
  beforeEach(() => {
    vi.resetModules();
    proxyCloudflareRequestMock.mockReset();
    handleLocalGitHubConnectMock.mockReset();
    shouldUseLocalGitHubAuthMock.mockReset();
    proxyCloudflareRequestMock.mockResolvedValue(new Response(null, { status: 302 }));
    handleLocalGitHubConnectMock.mockResolvedValue(new Response(null, { status: 302 }));
    shouldUseLocalGitHubAuthMock.mockReturnValue(false);
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

  it("uses the local auth flow for localhost environments", async () => {
    shouldUseLocalGitHubAuthMock.mockReturnValue(true);

    const { GET } = await import("@/app/api/github/connect/route");
    const request = {
      url: "http://localhost:3000/api/github/connect",
    } as NextRequest;

    await GET(request);

    expect(handleLocalGitHubConnectMock).toHaveBeenCalledWith(request.url);
    expect(proxyCloudflareRequestMock).not.toHaveBeenCalled();
  });
});
