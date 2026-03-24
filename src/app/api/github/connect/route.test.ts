import type { NextRequest } from "next/server";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { buildGitHubAuthorizeUrlMock, createOAuthStateMock } = vi.hoisted(() => ({
  buildGitHubAuthorizeUrlMock: vi.fn(),
  createOAuthStateMock: vi.fn(),
}));

vi.mock("@/lib/github", () => ({
  buildGitHubAuthorizeUrl: buildGitHubAuthorizeUrlMock,
}));

vi.mock("@/lib/session", () => ({
  createOAuthState: createOAuthStateMock,
}));

const originalEnv = { ...process.env };

function setRequiredGitHubEnv() {
  process.env.APP_URL = "https://vibe-tracker-max.vercel.app";
  process.env.GITHUB_APP_ID = "12345";
  process.env.GITHUB_APP_CLIENT_ID = "client-id";
  process.env.GITHUB_APP_CLIENT_SECRET = "client-secret";
  process.env.GITHUB_APP_PRIVATE_KEY = "private-key";
  process.env.GITHUB_APP_SLUG = "vibe-tracker";
  process.env.SESSION_ENCRYPTION_KEY = "session-key";
}

describe("GET /api/github/connect", () => {
  beforeEach(() => {
    vi.resetModules();
    buildGitHubAuthorizeUrlMock.mockReset();
    createOAuthStateMock.mockReset();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("starts OAuth when only Vercel Postgres env aliases are configured", async () => {
    setRequiredGitHubEnv();
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
    process.env.POSTGRES_PRISMA_URL =
      "postgresql://postgres:postgres@db.example.com:5432/vibe_tracker";
    process.env.POSTGRES_URL_NON_POOLING =
      "postgresql://postgres:postgres@db.example.com:5432/vibe_tracker_direct";
    createOAuthStateMock.mockResolvedValue("state-123");
    buildGitHubAuthorizeUrlMock.mockReturnValue(
      "https://github.com/login/oauth/authorize?state=state-123",
    );

    const { GET } = await import("@/app/api/github/connect/route");

    const response = await GET({
      url: "https://vibe-tracker-max.vercel.app/api/github/connect",
    } as NextRequest);

    expect(createOAuthStateMock).toHaveBeenCalledTimes(1);
    expect(buildGitHubAuthorizeUrlMock).toHaveBeenCalledWith("state-123");
    expect(response.headers.get("location")).toBe(
      "https://github.com/login/oauth/authorize?state=state-123",
    );
  });

  it("keeps blocking OAuth when no durable database url is configured", async () => {
    setRequiredGitHubEnv();
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
    delete process.env.POSTGRES_PRISMA_URL;
    delete process.env.POSTGRES_URL_NON_POOLING;
    delete process.env.POSTGRES_URL;

    const { GET } = await import("@/app/api/github/connect/route");

    const response = await GET({
      url: "https://vibe-tracker-max.vercel.app/api/github/connect",
    } as NextRequest);

    expect(createOAuthStateMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://vibe-tracker-max.vercel.app/?github=missing-config",
    );
  });
});
