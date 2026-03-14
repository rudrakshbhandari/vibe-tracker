import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getRequiredSocialSessionMock,
  getSocialFriendsMock,
} = vi.hoisted(() => ({
  getRequiredSocialSessionMock: vi.fn(),
  getSocialFriendsMock: vi.fn(),
}));

vi.mock("@/lib/social", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/social")>();
  return {
    ...actual,
    getRequiredSocialSession: getRequiredSocialSessionMock,
    getSocialFriends: getSocialFriendsMock,
  };
});

import { GET } from "@/app/api/social/friends/route";

describe("GET /api/social/friends", () => {
  beforeEach(() => {
    getRequiredSocialSessionMock.mockReset();
    getSocialFriendsMock.mockReset();
  });

  it("returns 401 when there is no social session", async () => {
    getRequiredSocialSessionMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/social/friends");

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(getSocialFriendsMock).not.toHaveBeenCalled();
  });

  it("returns friends payload with default window", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });
    getSocialFriendsMock.mockResolvedValue({
      window: "30d",
      friends: [],
      pendingInvites: [],
    });

    const request = new NextRequest("http://localhost/api/social/friends");

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      window: "30d",
      friends: [],
      pendingInvites: [],
    });
    expect(getSocialFriendsMock).toHaveBeenCalledWith("account-1", "30d");
  });

  it("passes window from query params", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });
    getSocialFriendsMock.mockResolvedValue({
      window: "7d",
      friends: [{ login: "friend1", rank: 1 }],
      pendingInvites: [],
    });

    const request = new NextRequest(
      "http://localhost/api/social/friends?window=7d",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getSocialFriendsMock).toHaveBeenCalledWith("account-1", "7d");
  });

  it("returns 400 when window is invalid", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });

    const request = new NextRequest(
      "http://localhost/api/social/friends?window=invalid",
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(getSocialFriendsMock).not.toHaveBeenCalled();
  });
});
