import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRequiredSocialSessionMock, createFriendInviteMock } = vi.hoisted(() => ({
  getRequiredSocialSessionMock: vi.fn(),
  createFriendInviteMock: vi.fn(),
}));

vi.mock("@/lib/social", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/social")>();
  return {
    ...actual,
    getRequiredSocialSession: getRequiredSocialSessionMock,
    createFriendInvite: createFriendInviteMock,
  };
});

import { POST } from "@/app/api/social/friends/invite/route";

describe("POST /api/social/friends/invite", () => {
  beforeEach(() => {
    getRequiredSocialSessionMock.mockReset();
    createFriendInviteMock.mockReset();
  });

  it("returns 401 when there is no social session", async () => {
    getRequiredSocialSessionMock.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(createFriendInviteMock).not.toHaveBeenCalled();
  });

  it("returns invite payload for authenticated user", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({ accountId: "account-1" });
    createFriendInviteMock.mockResolvedValue({
      token: "abc123",
      invitePath: "/social/invite/abc123",
      expiresAt: "2025-03-20T00:00:00.000Z",
    });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: "abc123",
      invitePath: "/social/invite/abc123",
      expiresAt: "2025-03-20T00:00:00.000Z",
    });
    expect(createFriendInviteMock).toHaveBeenCalledWith("account-1");
  });
});
