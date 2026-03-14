import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getRequiredSocialSessionMock,
  getSocialLeaderboardMock,
} = vi.hoisted(() => ({
  getRequiredSocialSessionMock: vi.fn(),
  getSocialLeaderboardMock: vi.fn(),
}));

vi.mock("@/lib/social", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/social")>();
  return {
    ...actual,
    getRequiredSocialSession: getRequiredSocialSessionMock,
    getSocialLeaderboard: getSocialLeaderboardMock,
  };
});

import { GET } from "@/app/api/social/leaderboard/route";

describe("GET /api/social/leaderboard", () => {
  beforeEach(() => {
    getRequiredSocialSessionMock.mockReset();
    getSocialLeaderboardMock.mockReset();
  });

  it("returns 401 when there is no social session", async () => {
    getRequiredSocialSessionMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/social/leaderboard");

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(getSocialLeaderboardMock).not.toHaveBeenCalled();
  });

  it("returns leaderboard with default scope and window", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });
    getSocialLeaderboardMock.mockResolvedValue({
      scope: "friends",
      window: "30d",
      entries: [{ rank: 1, login: "user1", vibeScore: 100 }],
    });

    const request = new NextRequest("http://localhost/api/social/leaderboard");

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scope: "friends",
      window: "30d",
      entries: [{ rank: 1, login: "user1", vibeScore: 100 }],
    });
    expect(getSocialLeaderboardMock).toHaveBeenCalledWith(
      "account-1",
      "friends",
      "30d",
    );
  });

  it("passes scope and window from query params", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });
    getSocialLeaderboardMock.mockResolvedValue({
      scope: "global",
      window: "7d",
      entries: [],
    });

    const request = new NextRequest(
      "http://localhost/api/social/leaderboard?scope=global&window=7d",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getSocialLeaderboardMock).toHaveBeenCalledWith(
      "account-1",
      "global",
      "7d",
    );
  });

  it("returns 400 when query params are invalid", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });

    const request = new NextRequest(
      "http://localhost/api/social/leaderboard?scope=invalid&window=90d",
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(getSocialLeaderboardMock).not.toHaveBeenCalled();
  });
});
