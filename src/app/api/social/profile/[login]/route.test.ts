import type { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOptionalUserSessionMock, getSocialProfileByLoginMock } = vi.hoisted(() => ({
  getOptionalUserSessionMock: vi.fn(),
  getSocialProfileByLoginMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getOptionalUserSession: getOptionalUserSessionMock,
}));

vi.mock("@/lib/social", () => ({
  getSocialProfileByLogin: getSocialProfileByLoginMock,
}));

import { GET } from "@/app/api/social/profile/[login]/route";

describe("GET /api/social/profile/[login]", () => {
  beforeEach(() => {
    getOptionalUserSessionMock.mockReset();
    getSocialProfileByLoginMock.mockReset();
  });

  it("returns 404 for a hidden profile", async () => {
    getOptionalUserSessionMock.mockResolvedValue(null);
    getSocialProfileByLoginMock.mockResolvedValue(null);

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ login: "private-user" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns the visible profile payload", async () => {
    getOptionalUserSessionMock.mockResolvedValue({
      accountId: "viewer-1",
    });
    getSocialProfileByLoginMock.mockResolvedValue({
      login: "public-user",
      isPublic: true,
    });

    const response = await GET({} as NextRequest, {
      params: Promise.resolve({ login: "public-user" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      login: "public-user",
      isPublic: true,
    });
    expect(getSocialProfileByLoginMock).toHaveBeenCalledWith("public-user", "viewer-1");
  });
});
