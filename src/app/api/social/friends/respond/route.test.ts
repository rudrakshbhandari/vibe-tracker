import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getRequiredSocialSessionMock,
  respondToFriendInviteMock,
} = vi.hoisted(() => ({
  getRequiredSocialSessionMock: vi.fn(),
  respondToFriendInviteMock: vi.fn(),
}));

vi.mock("@/lib/social", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/social")>();
  return {
    ...actual,
    getRequiredSocialSession: getRequiredSocialSessionMock,
    respondToFriendInvite: respondToFriendInviteMock,
  };
});

import { POST } from "@/app/api/social/friends/respond/route";

describe("POST /api/social/friends/respond", () => {
  beforeEach(() => {
    getRequiredSocialSessionMock.mockReset();
    respondToFriendInviteMock.mockReset();
  });

  it("returns 401 when there is no social session", async () => {
    getRequiredSocialSessionMock.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/social/friends/respond", {
      method: "POST",
      body: JSON.stringify({ token: "validtoken123", action: "accept" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(respondToFriendInviteMock).not.toHaveBeenCalled();
  });

  it("returns 400 when payload is invalid", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });

    const request = new NextRequest("http://localhost/api/social/friends/respond", {
      method: "POST",
      body: JSON.stringify({ token: "short", action: "accept" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(respondToFriendInviteMock).not.toHaveBeenCalled();
  });

  it("returns 400 when action is invalid", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });

    const request = new NextRequest("http://localhost/api/social/friends/respond", {
      method: "POST",
      body: JSON.stringify({ token: "validtoken123", action: "invalid" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(respondToFriendInviteMock).not.toHaveBeenCalled();
  });

  it("accepts invite and returns status for valid request", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-2" });
    respondToFriendInviteMock.mockResolvedValue({
      status: "accepted",
      inviterLogin: "inviter",
    });

    const request = new NextRequest("http://localhost/api/social/friends/respond", {
      method: "POST",
      body: JSON.stringify({ token: "validtoken123", action: "accept" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "accepted",
      inviterLogin: "inviter",
    });
    expect(respondToFriendInviteMock).toHaveBeenCalledWith(
      "account-2",
      "validtoken123",
      "accept",
    );
  });

  it("returns 400 when respondToFriendInvite throws", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-2" });
    respondToFriendInviteMock.mockRejectedValue(new Error("Invite has expired"));

    const request = new NextRequest("http://localhost/api/social/friends/respond", {
      method: "POST",
      body: JSON.stringify({ token: "expiredtoken", action: "accept" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invite has expired");
  });
});
