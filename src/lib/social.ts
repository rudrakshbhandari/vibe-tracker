import { randomBytes } from "node:crypto";

import {
  FriendConnectionStatus,
  FriendInviteStatus,
  LeaderboardScope,
  LeaderboardVisibility,
  LeaderboardWindow,
  ProfileVisibility,
} from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { getOptionalUserSession } from "@/lib/session";

export const socialTabSchema = z.enum(["friends", "leaderboard", "profile"]);
export const socialScopeSchema = z.enum(["friends", "global"]);
export const socialWindowSchema = z.enum(["7d", "30d", "90d"]);
export const friendInviteActionSchema = z.enum(["accept", "decline"]);

export type SocialTab = z.infer<typeof socialTabSchema>;
export type SocialScope = z.infer<typeof socialScopeSchema>;
export type SocialWindow = z.infer<typeof socialWindowSchema>;
export type FriendInviteAction = z.infer<typeof friendInviteActionSchema>;

type ScoreTotals = {
  mergedAdditions: number;
  mergedDeletions: number;
  mergedCommits: number;
  activePeriods: number;
  vibeScore: number;
};

export type LeaderboardEntry = {
  accountId: string;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
  vibeScore: number;
  mergedAdditions: number;
  mergedDeletions: number;
  mergedCommits: number;
  activePeriods: number;
  trendDelta: number;
  rank: number;
  isCurrentUser: boolean;
};

export type FriendSummary = {
  accountId: string;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
  vibeScore: number;
  mergedAdditions: number;
  mergedDeletions: number;
  mergedCommits: number;
  activePeriods: number;
  trendDelta: number;
  rank: number;
};

export type SocialSettings = {
  bio: string;
  profileVisibility: "PRIVATE" | "PUBLIC";
  leaderboardVisibility: "HIDDEN" | "PUBLIC";
  previewPath: string;
};

export type SocialProfile = {
  accountId: string;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string;
  isPublic: boolean;
  isFriend: boolean;
  vibeScore: number;
  mergedAdditions: number;
  mergedDeletions: number;
  mergedCommits: number;
  activePeriods: number;
  trendDelta: number;
  globalRank: number | null;
};

export const socialProfileUpdateSchema = z.object({
  bio: z.string().trim().max(160).default(""),
  profileVisibility: z.enum(["PRIVATE", "PUBLIC"]),
  leaderboardVisibility: z.enum(["HIDDEN", "PUBLIC"]),
});

export const inviteTokenSchema = z.object({
  token: z.string().min(8),
});

const WINDOW_DAYS: Record<SocialWindow, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const DEFAULT_WINDOW: SocialWindow = "30d";
const DEFAULT_SCOPE: SocialScope = "friends";

function getWindowStart(window: SocialWindow, now = new Date()) {
  return new Date(now.getTime() - WINDOW_DAYS[window] * 24 * 60 * 60 * 1000);
}

function getPreviousWindowStart(window: SocialWindow, now = new Date()) {
  return new Date(now.getTime() - WINDOW_DAYS[window] * 2 * 24 * 60 * 60 * 1000);
}

function getPrismaWindow(window: SocialWindow) {
  if (window === "7d") {
    return LeaderboardWindow.DAYS_7;
  }
  if (window === "90d") {
    return LeaderboardWindow.DAYS_90;
  }
  return LeaderboardWindow.DAYS_30;
}

function getProfilePath(login: string) {
  return `/social/profile/${login}`;
}

function getPublicInvitePath(token: string) {
  return `/social/invite/${token}`;
}

type PendingInviteRecord = {
  id: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
};

function serializePendingInvite(invite: PendingInviteRecord) {
  return {
    token: invite.token,
    invitePath: getPublicInvitePath(invite.token),
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
  };
}

async function getCanonicalPendingFriendInvite(accountId: string) {
  const pendingInvites = await db.friendInvite.findMany({
    where: {
      inviterAccountId: accountId,
      status: FriendInviteStatus.PENDING,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    select: {
      id: true,
      token: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  if (pendingInvites.length === 0) {
    return null;
  }

  const [canonicalInvite, ...staleInvites] = pendingInvites;

  if (staleInvites.length > 0) {
    await db.friendInvite.updateMany({
      where: {
        id: {
          in: staleInvites.map((invite) => invite.id),
        },
      },
      data: {
        status: FriendInviteStatus.EXPIRED,
      },
    });
  }

  return canonicalInvite;
}

export function buildFriendPairKey(accountIdA: string, accountIdB: string) {
  return [accountIdA, accountIdB].sort().join(":");
}

export function calculateVibeScore(input: Omit<ScoreTotals, "vibeScore">) {
  const weightedTotal =
    input.mergedAdditions +
    Math.round(input.mergedDeletions * 0.7) +
    input.mergedCommits * 28 +
    input.activePeriods * 45;

  return Math.max(0, Math.round(weightedTotal / 10));
}

function summarizeShippedActivity(
  dailyStats: Array<{
    day: Date;
    additions: number;
    deletions: number;
    commitCount: number;
  }>,
): ScoreTotals {
  const activePeriods = new Set(
    dailyStats.map((stat) => stat.day.toISOString().slice(0, 10)),
  ).size;
  const mergedAdditions = dailyStats.reduce((sum, stat) => sum + stat.additions, 0);
  const mergedDeletions = dailyStats.reduce((sum, stat) => sum + stat.deletions, 0);
  const mergedCommits = dailyStats.reduce((sum, stat) => sum + stat.commitCount, 0);

  return {
    mergedAdditions,
    mergedDeletions,
    mergedCommits,
    activePeriods,
    vibeScore: calculateVibeScore({
      mergedAdditions,
      mergedDeletions,
      mergedCommits,
      activePeriods,
    }),
  };
}

async function getShippedTotalsForRange(
  accountId: string,
  start: Date,
  end?: Date,
) {
  const dailyStats = await db.dailyUserRepoStats.findMany({
    where: {
      accountId,
      day: {
        gte: start,
        ...(end ? { lt: end } : {}),
      },
    },
    select: {
      day: true,
      additions: true,
      deletions: true,
      commitCount: true,
    },
  });

  return summarizeShippedActivity(dailyStats);
}

async function getWindowTotals(accountId: string, window: SocialWindow) {
  return getShippedTotalsForRange(accountId, getWindowStart(window));
}

async function getTrendDelta(accountId: string, window: SocialWindow) {
  const now = new Date();
  const current = await getShippedTotalsForRange(accountId, getWindowStart(window, now), now);
  const previous = await getShippedTotalsForRange(
    accountId,
    getPreviousWindowStart(window, now),
    getWindowStart(window, now),
  );

  return current.vibeScore - previous.vibeScore;
}

async function markSocialOnboarding(accountId: string) {
  await db.gitHubAccount.update({
    where: {
      id: accountId,
    },
    data: {
      socialOnboardingCompletedAt: new Date(),
    },
  });
}

export async function getRequiredSocialSession() {
  const session = await getOptionalUserSession();
  return session;
}

async function getFriendConnections(accountId: string) {
  return db.friendConnection.findMany({
    where: {
      status: FriendConnectionStatus.ACCEPTED,
      OR: [
        {
          requesterAccountId: accountId,
        },
        {
          addresseeAccountId: accountId,
        },
      ],
    },
    include: {
      requester: true,
      addressee: true,
    },
  });
}

async function getFriendAccountIds(accountId: string) {
  const connections = await getFriendConnections(accountId);

  return connections.map((connection) =>
    connection.requesterAccountId === accountId
      ? connection.addresseeAccountId
      : connection.requesterAccountId,
  );
}

async function areFriends(viewerAccountId: string, profileAccountId: string) {
  if (viewerAccountId === profileAccountId) {
    return true;
  }

  const connection = await db.friendConnection.findUnique({
    where: {
      pairKey: buildFriendPairKey(viewerAccountId, profileAccountId),
    },
    select: {
      status: true,
    },
  });

  return connection?.status === FriendConnectionStatus.ACCEPTED;
}

async function getIdentity(accountId: string) {
  return db.gitHubAccount.findUnique({
    where: {
      id: accountId,
    },
    select: {
      id: true,
      login: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      profileVisibility: true,
      leaderboardVisibility: true,
      socialOnboardingCompletedAt: true,
    },
  });
}

async function getGlobalRank(accountId: string, window: SocialWindow) {
  const snapshot = await db.leaderboardSnapshot.findUnique({
    where: {
      accountId_window_scope: {
        accountId,
        window: getPrismaWindow(window),
        scope: LeaderboardScope.GLOBAL,
      },
    },
    select: {
      rank: true,
    },
  });

  return snapshot?.rank ?? null;
}

async function buildFriendLeaderboardEntries(
  viewerAccountId: string,
  window: SocialWindow,
) {
  const friendIds = await getFriendAccountIds(viewerAccountId);
  const accountIds = Array.from(new Set([viewerAccountId, ...friendIds]));

  const accounts = await db.gitHubAccount.findMany({
    where: {
      id: {
        in: accountIds,
      },
    },
    select: {
      id: true,
      login: true,
      displayName: true,
      avatarUrl: true,
    },
  });

  const entries = await Promise.all(
    accounts.map(async (account) => {
      const [totals, trendDelta] = await Promise.all([
        getWindowTotals(account.id, window),
        getTrendDelta(account.id, window),
      ]);

      return {
        accountId: account.id,
        login: account.login,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
        vibeScore: totals.vibeScore,
        mergedAdditions: totals.mergedAdditions,
        mergedDeletions: totals.mergedDeletions,
        mergedCommits: totals.mergedCommits,
        activePeriods: totals.activePeriods,
        trendDelta,
        rank: 0,
        isCurrentUser: account.id === viewerAccountId,
      } satisfies LeaderboardEntry;
    }),
  );

  return entries
    .sort((left, right) => {
      if (right.vibeScore !== left.vibeScore) {
        return right.vibeScore - left.vibeScore;
      }
      return left.login.localeCompare(right.login);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export async function refreshGlobalLeaderboardSnapshots(window?: SocialWindow) {
  const windows = window ? [window] : (["7d", "30d", "90d"] as const);

  for (const currentWindow of windows) {
    const eligibleAccounts = await db.gitHubAccount.findMany({
      where: {
        leaderboardVisibility: LeaderboardVisibility.PUBLIC,
      },
      select: {
        id: true,
        login: true,
      },
    });

    const rankedEntries = await Promise.all(
      eligibleAccounts.map(async (account) => {
        const totals = await getWindowTotals(account.id, currentWindow);

        return {
          accountId: account.id,
          vibeScore: totals.vibeScore,
          mergedAdditions: totals.mergedAdditions,
          mergedDeletions: totals.mergedDeletions,
          mergedCommits: totals.mergedCommits,
          activePeriods: totals.activePeriods,
          login: account.login,
        };
      }),
    );

    const sortedEntries = rankedEntries
      .sort((left, right) => {
        if (right.vibeScore !== left.vibeScore) {
          return right.vibeScore - left.vibeScore;
        }
        return left.login.localeCompare(right.login);
      })
      .map((entry, index) => ({
        accountId: entry.accountId,
        window: getPrismaWindow(currentWindow),
        scope: LeaderboardScope.GLOBAL,
        vibeScore: entry.vibeScore,
        mergedAdditions: entry.mergedAdditions,
        mergedDeletions: entry.mergedDeletions,
        mergedCommits: entry.mergedCommits,
        activePeriods: entry.activePeriods,
        rank: index + 1,
        calculatedAt: new Date(),
      }));

    await db.$transaction([
      db.leaderboardSnapshot.deleteMany({
        where: {
          window: getPrismaWindow(currentWindow),
          scope: LeaderboardScope.GLOBAL,
        },
      }),
      ...(sortedEntries.length > 0
        ? [
            db.leaderboardSnapshot.createMany({
              data: sortedEntries,
            }),
          ]
        : []),
    ]);
  }
}

export async function refreshLeaderboardSnapshotsForAccount() {
  await refreshGlobalLeaderboardSnapshots();
}

export async function getSocialMe(accountId: string) {
  const [identity, totals, trendDelta, friends, pendingInvite, globalRank] =
    await Promise.all([
      getIdentity(accountId),
      getWindowTotals(accountId, DEFAULT_WINDOW),
      getTrendDelta(accountId, DEFAULT_WINDOW),
      buildFriendLeaderboardEntries(accountId, DEFAULT_WINDOW),
      getCanonicalPendingFriendInvite(accountId),
      getGlobalRank(accountId, DEFAULT_WINDOW),
    ]);

  if (!identity) {
    throw new Error("Account not found");
  }

  const friendRank =
    friends.find((entry) => entry.accountId === accountId)?.rank ?? 1;

  return {
    profile: {
      accountId: identity.id,
      login: identity.login,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
    },
    settings: {
      bio: identity.bio ?? "",
      profileVisibility: identity.profileVisibility,
      leaderboardVisibility: identity.leaderboardVisibility,
      previewPath: getProfilePath(identity.login),
    } satisfies SocialSettings,
    counts: {
      friendCount: Math.max(0, friends.length - 1),
      pendingInviteCount: pendingInvite ? 1 : 0,
    },
    score: {
      window: DEFAULT_WINDOW,
      vibeScore: totals.vibeScore,
      mergedAdditions: totals.mergedAdditions,
      mergedDeletions: totals.mergedDeletions,
      mergedCommits: totals.mergedCommits,
      activePeriods: totals.activePeriods,
      trendDelta,
    },
    ranks: {
      friends: friendRank,
      global:
        identity.leaderboardVisibility === LeaderboardVisibility.PUBLIC
          ? globalRank
          : null,
    },
    defaults: {
      tab: "friends" as const,
      scope: DEFAULT_SCOPE,
      window: DEFAULT_WINDOW,
    },
  };
}

export async function updateSocialProfile(
  accountId: string,
  input: z.infer<typeof socialProfileUpdateSchema>,
) {
  await db.gitHubAccount.update({
    where: {
      id: accountId,
    },
    data: {
      bio: input.bio || null,
      profileVisibility:
        input.profileVisibility === "PUBLIC"
          ? ProfileVisibility.PUBLIC
          : ProfileVisibility.PRIVATE,
      leaderboardVisibility:
        input.leaderboardVisibility === "PUBLIC"
          ? LeaderboardVisibility.PUBLIC
          : LeaderboardVisibility.HIDDEN,
      socialOnboardingCompletedAt: new Date(),
    },
  });

  await refreshGlobalLeaderboardSnapshots();
  return getSocialMe(accountId);
}

export async function createFriendInvite(accountId: string) {
  let invite = await getCanonicalPendingFriendInvite(accountId);

  if (!invite) {
    const token = randomBytes(18).toString("hex");
    invite = await db.friendInvite.create({
      data: {
        token,
        inviterAccountId: accountId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  await markSocialOnboarding(accountId);

  return serializePendingInvite(invite);
}

export async function getSocialFriends(accountId: string, window: SocialWindow = DEFAULT_WINDOW) {
  const [entries, pendingInvite] = await Promise.all([
    buildFriendLeaderboardEntries(accountId, window),
    getCanonicalPendingFriendInvite(accountId),
  ]);

  return {
    window,
    friends: entries
      .filter((entry) => entry.accountId !== accountId)
      .map((entry) => ({
        accountId: entry.accountId,
        login: entry.login,
        displayName: entry.displayName,
        avatarUrl: entry.avatarUrl,
        vibeScore: entry.vibeScore,
        mergedAdditions: entry.mergedAdditions,
        mergedDeletions: entry.mergedDeletions,
        mergedCommits: entry.mergedCommits,
        activePeriods: entry.activePeriods,
        trendDelta: entry.trendDelta,
        rank: entry.rank,
      }) satisfies FriendSummary),
    pendingInvites: pendingInvite ? [serializePendingInvite(pendingInvite)] : [],
  };
}

export async function getSocialLeaderboard(
  viewerAccountId: string,
  scope: SocialScope = DEFAULT_SCOPE,
  window: SocialWindow = DEFAULT_WINDOW,
) {
  if (scope === "friends") {
    return {
      scope,
      window,
      entries: await buildFriendLeaderboardEntries(viewerAccountId, window),
    };
  }

  const snapshots = await db.leaderboardSnapshot.findMany({
    where: {
      scope: LeaderboardScope.GLOBAL,
      window: getPrismaWindow(window),
    },
    orderBy: {
      rank: "asc",
    },
    include: {
      account: {
        select: {
          id: true,
          login: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  const entries = await Promise.all(
    snapshots.map(async (snapshot) => ({
      accountId: snapshot.account.id,
      login: snapshot.account.login,
      displayName: snapshot.account.displayName,
      avatarUrl: snapshot.account.avatarUrl,
      vibeScore: snapshot.vibeScore,
      mergedAdditions: snapshot.mergedAdditions,
      mergedDeletions: snapshot.mergedDeletions,
      mergedCommits: snapshot.mergedCommits,
      activePeriods: snapshot.activePeriods,
      trendDelta: await getTrendDelta(snapshot.account.id, window),
      rank: snapshot.rank,
      isCurrentUser: snapshot.account.id === viewerAccountId,
    })),
  );

  return {
    scope,
    window,
    entries,
  };
}

export async function getSocialProfileByLogin(
  login: string,
  viewerAccountId?: string,
) {
  const account = await db.gitHubAccount.findUnique({
    where: {
      login,
    },
    select: {
      id: true,
      login: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      profileVisibility: true,
      leaderboardVisibility: true,
    },
  });

  if (!account) {
    return null;
  }

  const viewerIsFriend = viewerAccountId
    ? await areFriends(viewerAccountId, account.id)
    : false;
  const isCurrentUser = viewerAccountId === account.id;
  const canView =
    isCurrentUser ||
    account.profileVisibility === ProfileVisibility.PUBLIC ||
    viewerIsFriend;

  if (!canView) {
    return null;
  }

  const [totals, trendDelta, globalRank] = await Promise.all([
    getWindowTotals(account.id, DEFAULT_WINDOW),
    getTrendDelta(account.id, DEFAULT_WINDOW),
    account.profileVisibility === ProfileVisibility.PUBLIC &&
    account.leaderboardVisibility === LeaderboardVisibility.PUBLIC
      ? getGlobalRank(account.id, DEFAULT_WINDOW)
      : Promise.resolve(null),
  ]);

  return {
    accountId: account.id,
    login: account.login,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    bio: account.bio ?? "",
    isPublic: account.profileVisibility === ProfileVisibility.PUBLIC,
    isFriend: viewerIsFriend,
    vibeScore: totals.vibeScore,
    mergedAdditions: totals.mergedAdditions,
    mergedDeletions: totals.mergedDeletions,
    mergedCommits: totals.mergedCommits,
    activePeriods: totals.activePeriods,
    trendDelta,
    globalRank,
  } satisfies SocialProfile;
}

export async function getFriendInviteDetails(token: string) {
  const invite = await db.friendInvite.findUnique({
    where: {
      token,
    },
    include: {
      inviter: {
        select: {
          id: true,
          login: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      claimedBy: {
        select: {
          id: true,
          login: true,
        },
      },
    },
  });

  if (!invite) {
    return null;
  }

  const expired = invite.expiresAt <= new Date();

  return {
    token: invite.token,
    status: expired && invite.status === FriendInviteStatus.PENDING ? "EXPIRED" : invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    inviter: invite.inviter,
    claimedBy: invite.claimedBy,
  };
}

export async function respondToFriendInvite(
  accountId: string,
  token: string,
  action: FriendInviteAction,
) {
  const invite = await db.friendInvite.findUnique({
    where: {
      token,
    },
    include: {
      inviter: {
        select: {
          id: true,
          login: true,
        },
      },
    },
  });

  if (!invite) {
    throw new Error("Invite not found");
  }

  if (invite.inviterAccountId === accountId) {
    throw new Error("You cannot claim your own invite");
  }

  if (invite.status !== FriendInviteStatus.PENDING) {
    throw new Error("Invite is no longer active");
  }

  if (invite.expiresAt <= new Date()) {
    await db.friendInvite.update({
      where: {
        id: invite.id,
      },
      data: {
        status: FriendInviteStatus.EXPIRED,
      },
    });
    throw new Error("Invite has expired");
  }

  const pairKey = buildFriendPairKey(invite.inviterAccountId, accountId);
  const existingConnection = await db.friendConnection.findUnique({
    where: {
      pairKey,
    },
  });

  if (existingConnection?.status === FriendConnectionStatus.BLOCKED) {
    throw new Error("This connection is blocked");
  }

  if (action === "decline") {
    await db.friendInvite.update({
      where: {
        id: invite.id,
      },
      data: {
        claimedByAccountId: accountId,
        claimedAt: new Date(),
        status: FriendInviteStatus.DECLINED,
      },
    });

    return {
      status: "declined" as const,
      inviterLogin: invite.inviter.login,
    };
  }

  await db.$transaction([
    existingConnection
      ? db.friendConnection.update({
          where: {
            id: existingConnection.id,
          },
          data: {
            requesterAccountId: invite.inviterAccountId,
            addresseeAccountId: accountId,
            status: FriendConnectionStatus.ACCEPTED,
          },
        })
      : db.friendConnection.create({
          data: {
            requesterAccountId: invite.inviterAccountId,
            addresseeAccountId: accountId,
            pairKey,
            status: FriendConnectionStatus.ACCEPTED,
          },
        }),
    db.friendInvite.update({
      where: {
        id: invite.id,
      },
      data: {
        claimedByAccountId: accountId,
        claimedAt: new Date(),
        status: FriendInviteStatus.ACCEPTED,
      },
    }),
  ]);

  await markSocialOnboarding(accountId);

  return {
    status: "accepted" as const,
    inviterLogin: invite.inviter.login,
  };
}
