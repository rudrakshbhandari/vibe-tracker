import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, randomBytesMock, getOptionalUserSessionMock } = vi.hoisted(() => ({
  dbMock: {
    friendInvite: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    gitHubAccount: {
      update: vi.fn(),
    },
  },
  randomBytesMock: vi.fn(),
  getOptionalUserSessionMock: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomBytes: randomBytesMock,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/session", () => ({
  getOptionalUserSession: getOptionalUserSessionMock,
}));

import { buildFriendPairKey, calculateVibeScore, createFriendInvite } from "@/lib/social";

describe("social helpers", () => {
  beforeEach(() => {
    dbMock.friendInvite.create.mockReset();
    dbMock.friendInvite.findMany.mockReset();
    dbMock.friendInvite.updateMany.mockReset();
    dbMock.gitHubAccount.update.mockReset();
    randomBytesMock.mockReset();
    getOptionalUserSessionMock.mockReset();

    dbMock.gitHubAccount.update.mockResolvedValue({});
    dbMock.friendInvite.updateMany.mockResolvedValue({ count: 0 });
  });

  it("normalizes friend pair keys regardless of order", () => {
    expect(buildFriendPairKey("user-b", "user-a")).toBe("user-a:user-b");
    expect(buildFriendPairKey("user-a", "user-b")).toBe("user-a:user-b");
  });

  it("calculates higher vibe scores for more shipped output", () => {
    const baseline = calculateVibeScore({
      mergedAdditions: 120,
      mergedDeletions: 40,
      mergedCommits: 3,
      activePeriods: 2,
    });
    const stronger = calculateVibeScore({
      mergedAdditions: 400,
      mergedDeletions: 120,
      mergedCommits: 10,
      activePeriods: 6,
    });

    expect(stronger).toBeGreaterThan(baseline);
  });

  it("returns zero when there is no shipped activity", () => {
    expect(
      calculateVibeScore({
        mergedAdditions: 0,
        mergedDeletions: 0,
        mergedCommits: 0,
        activePeriods: 0,
      }),
    ).toBe(0);
  });

  it("reuses the existing active invite instead of creating another token", async () => {
    dbMock.friendInvite.findMany.mockResolvedValue([
      {
        id: "invite-1",
        token: "existing-token",
        createdAt: new Date("2026-03-26T12:00:00.000Z"),
        expiresAt: new Date("2026-04-02T12:00:00.000Z"),
      },
    ]);

    const invite = await createFriendInvite("account-1");

    expect(dbMock.friendInvite.create).not.toHaveBeenCalled();
    expect(invite).toEqual({
      token: "existing-token",
      invitePath: "/social/invite/existing-token",
      createdAt: "2026-03-26T12:00:00.000Z",
      expiresAt: "2026-04-02T12:00:00.000Z",
    });
  });

  it("expires duplicate pending invites and keeps the newest link canonical", async () => {
    dbMock.friendInvite.findMany.mockResolvedValue([
      {
        id: "invite-new",
        token: "newest-token",
        createdAt: new Date("2026-03-27T12:00:00.000Z"),
        expiresAt: new Date("2026-04-03T12:00:00.000Z"),
      },
      {
        id: "invite-old",
        token: "older-token",
        createdAt: new Date("2026-03-26T12:00:00.000Z"),
        expiresAt: new Date("2026-04-02T12:00:00.000Z"),
      },
    ]);

    const invite = await createFriendInvite("account-1");

    expect(dbMock.friendInvite.updateMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["invite-old"],
        },
      },
      data: {
        status: "EXPIRED",
      },
    });
    expect(invite.token).toBe("newest-token");
  });

  it("creates a new invite when no active link exists", async () => {
    dbMock.friendInvite.findMany.mockResolvedValue([]);
    randomBytesMock.mockReturnValue({
      toString: vi.fn(() => "fresh-token"),
    });
    dbMock.friendInvite.create.mockResolvedValue({
      id: "invite-1",
      token: "fresh-token",
      createdAt: new Date("2026-03-26T12:00:00.000Z"),
      expiresAt: new Date("2026-04-02T12:00:00.000Z"),
    });

    const invite = await createFriendInvite("account-1");

    expect(dbMock.friendInvite.create).toHaveBeenCalledWith({
      data: {
        token: "fresh-token",
        inviterAccountId: "account-1",
        expiresAt: expect.any(Date),
      },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    expect(invite.token).toBe("fresh-token");
  });
});
