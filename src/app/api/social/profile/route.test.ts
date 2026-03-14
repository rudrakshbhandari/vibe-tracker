import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRequiredSocialSessionMock, updateSocialProfileMock } = vi.hoisted(() => ({
  getRequiredSocialSessionMock: vi.fn(),
  updateSocialProfileMock: vi.fn(),
}));

vi.mock("@/lib/social", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/social")>();
  return {
    ...actual,
    getRequiredSocialSession: getRequiredSocialSessionMock,
    updateSocialProfile: updateSocialProfileMock,
  };
});

import { PATCH } from "@/app/api/social/profile/route";

describe("PATCH /api/social/profile", () => {
  beforeEach(() => {
    getRequiredSocialSessionMock.mockReset();
    updateSocialProfileMock.mockReset();
  });

  it("returns 401 when there is no social session", async () => {
    getRequiredSocialSessionMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/social/profile", {
      method: "PATCH",
      body: JSON.stringify({
        bio: "Hello",
        profileVisibility: "PUBLIC",
        leaderboardVisibility: "PUBLIC",
      }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(401);
    expect(updateSocialProfileMock).not.toHaveBeenCalled();
  });

  it("returns 400 when payload is invalid", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });

    const request = new NextRequest("http://localhost/api/social/profile", {
      method: "PATCH",
      body: JSON.stringify({ profileVisibility: "INVALID" }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    expect(updateSocialProfileMock).not.toHaveBeenCalled();
  });

  it("returns 400 when body is not valid JSON", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });

    const request = new NextRequest("http://localhost/api/social/profile", {
      method: "PATCH",
      body: "not json",
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    expect(updateSocialProfileMock).not.toHaveBeenCalled();
  });

  it("updates profile and returns social payload for valid request", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });
    const validData = {
      bio: "Builder",
      profileVisibility: "PUBLIC" as const,
      leaderboardVisibility: "HIDDEN" as const,
    };
    updateSocialProfileMock.mockResolvedValue({
      profile: { login: "octocat" },
      settings: { leaderboardVisibility: "HIDDEN" },
    });

    const request = new NextRequest("http://localhost/api/social/profile", {
      method: "PATCH",
      body: JSON.stringify(validData),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      profile: { login: "octocat" },
      settings: { leaderboardVisibility: "HIDDEN" },
    });
    expect(updateSocialProfileMock).toHaveBeenCalledWith("account-1", validData);
  });
});
