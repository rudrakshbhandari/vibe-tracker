import type { LeaderboardWindow } from "@/jobs/contracts";
import type { VibeWorkerEnv } from "@/env";

export const socialScopeValues = ["friends", "global"] as const;
export const socialWindowValues = ["7d", "30d", "90d"] as const;

type SocialScope = (typeof socialScopeValues)[number];
type SocialWindow = (typeof socialWindowValues)[number];

type ScoreRow = {
  vibe_score: number;
  merged_additions: number;
  merged_deletions: number;
  merged_commits: number;
  active_periods: number;
  trend_delta: number;
};

type FriendLeaderboardRow = {
  accountId: string;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
  vibeScore: number | null;
  mergedAdditions: number | null;
  mergedDeletions: number | null;
  mergedCommits: number | null;
  activePeriods: number | null;
  trendDelta: number | null;
};

function zeroScoreRow(): ScoreRow {
  return {
    vibe_score: 0,
    merged_additions: 0,
    merged_deletions: 0,
    merged_commits: 0,
    active_periods: 0,
    trend_delta: 0,
  };
}

async function getIdentity(env: VibeWorkerEnv, accountId: string) {
  return env.DB.prepare(
    `SELECT
      id,
      login,
      display_name,
      avatar_url,
      bio,
      profile_visibility,
      leaderboard_visibility
     FROM github_accounts
     WHERE id = ?`,
  )
    .bind(accountId)
    .first<{
      id: string;
      login: string;
      display_name: string | null;
      avatar_url: string | null;
      bio: string | null;
      profile_visibility: "PRIVATE" | "PUBLIC";
      leaderboard_visibility: "HIDDEN" | "PUBLIC";
    }>();
}

async function getScoreForWindow(
  env: VibeWorkerEnv,
  accountId: string,
  window: LeaderboardWindow,
) {
  return (
    (await env.DB.prepare(
      `SELECT
        vibe_score,
        merged_additions,
        merged_deletions,
        merged_commits,
        active_periods,
        trend_delta
       FROM leaderboard_scores
       WHERE account_id = ? AND window = ?`,
    )
      .bind(accountId, window)
      .first<ScoreRow>()) ?? zeroScoreRow()
  );
}

async function getGlobalRank(
  env: VibeWorkerEnv,
  accountId: string,
  window: LeaderboardWindow,
) {
  const rank = await env.DB.prepare(
    `SELECT rank
     FROM leaderboard_ranks
     WHERE account_id = ? AND window = ?`,
  )
    .bind(accountId, window)
    .first<{ rank: number }>();

  return rank?.rank ?? null;
}

async function getPendingInvite(env: VibeWorkerEnv, accountId: string) {
  return env.DB.prepare(
    `SELECT token, created_at, expires_at
     FROM friend_invites
     WHERE inviter_account_id = ?
       AND status = 'PENDING'
       AND expires_at > ?
     ORDER BY created_at DESC
     LIMIT 1`,
  )
    .bind(accountId, Date.now())
    .first<{
      token: string;
      created_at: number;
      expires_at: number;
    }>();
}

async function getFriendCount(env: VibeWorkerEnv, accountId: string) {
  const result = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM friend_connections
     WHERE status = 'ACCEPTED'
       AND (requester_account_id = ? OR addressee_account_id = ?)`,
  )
    .bind(accountId, accountId)
    .first<{ count: number }>();

  return Number(result?.count ?? 0);
}

async function getFriendLeaderboardEntries(
  env: VibeWorkerEnv,
  viewerAccountId: string,
  window: LeaderboardWindow,
) {
  const result = await env.DB.prepare(
    `SELECT
      github_accounts.id AS accountId,
      github_accounts.login AS login,
      github_accounts.display_name AS displayName,
      github_accounts.avatar_url AS avatarUrl,
      leaderboard_scores.vibe_score AS vibeScore,
      leaderboard_scores.merged_additions AS mergedAdditions,
      leaderboard_scores.merged_deletions AS mergedDeletions,
      leaderboard_scores.merged_commits AS mergedCommits,
      leaderboard_scores.active_periods AS activePeriods,
      leaderboard_scores.trend_delta AS trendDelta
     FROM github_accounts
     LEFT JOIN leaderboard_scores
       ON leaderboard_scores.account_id = github_accounts.id
      AND leaderboard_scores.window = ?
     WHERE github_accounts.id = ?
        OR github_accounts.id IN (
          SELECT CASE
            WHEN requester_account_id = ? THEN addressee_account_id
            ELSE requester_account_id
          END
          FROM friend_connections
          WHERE status = 'ACCEPTED'
            AND (requester_account_id = ? OR addressee_account_id = ?)
        )`,
  )
    .bind(window, viewerAccountId, viewerAccountId, viewerAccountId, viewerAccountId)
    .all<FriendLeaderboardRow>();

  return (result.results ?? [])
    .map((row) => ({
      accountId: row.accountId,
      login: row.login,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      vibeScore: row.vibeScore ?? 0,
      mergedAdditions: row.mergedAdditions ?? 0,
      mergedDeletions: row.mergedDeletions ?? 0,
      mergedCommits: row.mergedCommits ?? 0,
      activePeriods: row.activePeriods ?? 0,
      trendDelta: row.trendDelta ?? 0,
      isCurrentUser: row.accountId === viewerAccountId,
    }))
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

async function areFriends(
  env: VibeWorkerEnv,
  viewerAccountId: string,
  profileAccountId: string,
) {
  if (viewerAccountId === profileAccountId) {
    return true;
  }

  const pairKey = [viewerAccountId, profileAccountId].sort().join(":");
  const result = await env.DB.prepare(
    `SELECT status
     FROM friend_connections
     WHERE pair_key = ?`,
  )
    .bind(pairKey)
    .first<{ status: string }>();

  return result?.status === "ACCEPTED";
}

export async function getSocialMe(env: VibeWorkerEnv, accountId: string) {
  const [identity, score, friendEntries, pendingInvite, globalRank, friendCount] =
    await Promise.all([
      getIdentity(env, accountId),
      getScoreForWindow(env, accountId, "30d"),
      getFriendLeaderboardEntries(env, accountId, "30d"),
      getPendingInvite(env, accountId),
      getGlobalRank(env, accountId, "30d"),
      getFriendCount(env, accountId),
    ]);

  if (!identity) {
    throw new Error("Account not found");
  }

  return {
    profile: {
      accountId: identity.id,
      login: identity.login,
      displayName: identity.display_name,
      avatarUrl: identity.avatar_url,
    },
    settings: {
      bio: identity.bio ?? "",
      profileVisibility: identity.profile_visibility,
      leaderboardVisibility: identity.leaderboard_visibility,
      previewPath: `/social/profile/${identity.login}`,
    },
    counts: {
      friendCount,
      pendingInviteCount: pendingInvite ? 1 : 0,
    },
    score: {
      window: "30d",
      vibeScore: score.vibe_score,
      mergedAdditions: score.merged_additions,
      mergedDeletions: score.merged_deletions,
      mergedCommits: score.merged_commits,
      activePeriods: score.active_periods,
      trendDelta: score.trend_delta,
    },
    ranks: {
      friends:
        friendEntries.find((entry) => entry.accountId === accountId)?.rank ?? 1,
      global:
        identity.leaderboard_visibility === "PUBLIC" ? globalRank : null,
    },
    defaults: {
      tab: "friends",
      scope: "friends",
      window: "30d",
    },
  };
}

export async function getSocialFriends(
  env: VibeWorkerEnv,
  accountId: string,
  window: SocialWindow = "30d",
) {
  const [friendEntries, pendingInvite] = await Promise.all([
    getFriendLeaderboardEntries(env, accountId, window),
    getPendingInvite(env, accountId),
  ]);

  return {
    window,
    friends: friendEntries
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
      })),
    pendingInvites: pendingInvite
      ? [
          {
            token: pendingInvite.token,
            invitePath: `/social/invite/${pendingInvite.token}`,
            createdAt: new Date(pendingInvite.created_at).toISOString(),
            expiresAt: new Date(pendingInvite.expires_at).toISOString(),
          },
        ]
      : [],
  };
}

export async function getSocialLeaderboard(
  env: VibeWorkerEnv,
  viewerAccountId: string,
  scope: SocialScope = "friends",
  window: SocialWindow = "30d",
) {
  if (scope === "friends") {
    return {
      scope,
      window,
      entries: await getFriendLeaderboardEntries(env, viewerAccountId, window),
    };
  }

  const result = await env.DB.prepare(
    `SELECT
      leaderboard_ranks.rank AS rank,
      leaderboard_ranks.account_id AS accountId,
      leaderboard_ranks.vibe_score AS vibeScore,
      leaderboard_ranks.merged_additions AS mergedAdditions,
      leaderboard_ranks.merged_deletions AS mergedDeletions,
      leaderboard_ranks.merged_commits AS mergedCommits,
      leaderboard_ranks.active_periods AS activePeriods,
      leaderboard_ranks.trend_delta AS trendDelta,
      github_accounts.login AS login,
      github_accounts.display_name AS displayName,
      github_accounts.avatar_url AS avatarUrl
     FROM leaderboard_ranks
     INNER JOIN github_accounts
       ON github_accounts.id = leaderboard_ranks.account_id
     WHERE leaderboard_ranks.window = ?
     ORDER BY leaderboard_ranks.rank ASC`,
  )
    .bind(window)
    .all<{
      rank: number;
      accountId: string;
      vibeScore: number;
      mergedAdditions: number;
      mergedDeletions: number;
      mergedCommits: number;
      activePeriods: number;
      trendDelta: number;
      login: string;
      displayName: string | null;
      avatarUrl: string | null;
    }>();

  return {
    scope,
    window,
    entries: (result.results ?? []).map((row) => ({
      ...row,
      isCurrentUser: row.accountId === viewerAccountId,
    })),
  };
}

export async function getSocialProfileByLogin(
  env: VibeWorkerEnv,
  login: string,
  viewerAccountId?: string | null,
) {
  const account = await env.DB.prepare(
    `SELECT
      id,
      login,
      display_name,
      avatar_url,
      bio,
      profile_visibility,
      leaderboard_visibility
     FROM github_accounts
     WHERE login = ?`,
  )
    .bind(login)
    .first<{
      id: string;
      login: string;
      display_name: string | null;
      avatar_url: string | null;
      bio: string | null;
      profile_visibility: "PRIVATE" | "PUBLIC";
      leaderboard_visibility: "HIDDEN" | "PUBLIC";
    }>();

  if (!account) {
    return null;
  }

  const viewerIsFriend = viewerAccountId
    ? await areFriends(env, viewerAccountId, account.id)
    : false;
  const isCurrentUser = viewerAccountId === account.id;
  const canView =
    isCurrentUser || account.profile_visibility === "PUBLIC" || viewerIsFriend;

  if (!canView) {
    return null;
  }

  const [score, globalRank] = await Promise.all([
    getScoreForWindow(env, account.id, "30d"),
    account.profile_visibility === "PUBLIC" &&
    account.leaderboard_visibility === "PUBLIC"
      ? getGlobalRank(env, account.id, "30d")
      : Promise.resolve(null),
  ]);

  return {
    accountId: account.id,
    login: account.login,
    displayName: account.display_name,
    avatarUrl: account.avatar_url,
    bio: account.bio ?? "",
    isPublic: account.profile_visibility === "PUBLIC",
    isFriend: viewerIsFriend,
    vibeScore: score.vibe_score,
    mergedAdditions: score.merged_additions,
    mergedDeletions: score.merged_deletions,
    mergedCommits: score.merged_commits,
    activePeriods: score.active_periods,
    trendDelta: score.trend_delta,
    globalRank,
  };
}
