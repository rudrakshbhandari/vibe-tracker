import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRequiredSocialSessionMock, getSocialMeMock } = vi.hoisted(() => ({
  getRequiredSocialSessionMock: vi.fn(),
  getSocialMeMock: vi.fn(),
}));

vi.mock("@/lib/social", () => ({
  getRequiredSocialSession: getRequiredSocialSessionMock,
  getSocialMe: getSocialMeMock,
}));

import { GET } from "@/app/api/social/me/route";

describe("GET /api/social/me", () => {
  beforeEach(() => {
    getRequiredSocialSessionMock.mockReset();
    getSocialMeMock.mockReset();
  });

  it("returns 401 when there is no social session", async () => {
    getRequiredSocialSessionMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns the social payload for an authenticated user", async () => {
    getRequiredSocialSessionMock.mockResolvedValue({
      accountId: "account-1",
    });
    getSocialMeMock.mockResolvedValue({
      profile: {
        login: "octocat",
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      profile: {
        login: "octocat",
      },
    });
    expect(getSocialMeMock).toHaveBeenCalledWith("account-1");
  });
});
