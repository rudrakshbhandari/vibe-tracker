import { describe, expect, it } from "vitest";

import worker from "@/index";
import type { VibeWorkerEnv } from "@/env";

type AccountRow = {
  id: string;
  login: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  profile_visibility: "PRIVATE" | "PUBLIC";
  leaderboard_visibility: "HIDDEN" | "PUBLIC";
};

type ScoreRow = {
  account_id: string;
  window: "7d" | "30d" | "90d";
  vibe_score: number;
  merged_additions: number;
  merged_deletions: number;
  merged_commits: number;
  active_periods: number;
  trend_delta: number;
};

type FriendConnectionRow = {
  requester_account_id: string;
  addressee_account_id: string;
  pair_key: string;
  status: string;
};

type FriendInviteRow = {
  inviter_account_id: string;
  token: string;
  created_at: number;
  expires_at: number;
  status: string;
};

type LeaderboardRankRow = {
  window: "7d" | "30d" | "90d";
  rank: number;
  account_id: string;
  vibe_score: number;
  merged_additions: number;
  merged_deletions: number;
  merged_commits: number;
  active_periods: number;
  trend_delta: number;
};

type InstallationGrantRow = {
  account_id: string;
  installation_id: string;
};

type RepositoryRow = {
  id: string;
  installation_id: string;
  owner: string;
  name: string;
  is_private: number;
  sync_enabled: number;
};

type DailyStatRow = {
  account_id: string;
  repository_id: string;
  day_utc: string;
  additions: number;
  deletions: number;
  merged_pr_count: number;
  commit_count: number;
};

class FakePreparedStatement {
  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string,
    private args: unknown[] = [],
  ) {}

  bind(...args: unknown[]) {
    return new FakePreparedStatement(this.db, this.sql, args);
  }

  async first<T>() {
    return (this.db.first(this.sql, this.args) ?? null) as T | null;
  }

  async all<T>() {
    return { results: this.db.all(this.sql, this.args) as T[] };
  }

  async run() {
    return { success: true };
  }
}

class FakeD1Database {
  readonly accounts: AccountRow[] = [
    {
      id: "account-1",
      login: "octocat",
      display_name: "The Octocat",
      avatar_url: "https://avatars.example.com/octocat",
      bio: "Ships code",
      profile_visibility: "PUBLIC",
      leaderboard_visibility: "PUBLIC",
    },
    {
      id: "account-2",
      login: "friend",
      display_name: "Friend",
      avatar_url: null,
      bio: "",
      profile_visibility: "PUBLIC",
      leaderboard_visibility: "PUBLIC",
    },
  ];

  readonly scores: ScoreRow[] = [
    {
      account_id: "account-1",
      window: "30d",
      vibe_score: 123,
      merged_additions: 400,
      merged_deletions: 100,
      merged_commits: 12,
      active_periods: 6,
      trend_delta: 8,
    },
    {
      account_id: "account-2",
      window: "30d",
      vibe_score: 90,
      merged_additions: 250,
      merged_deletions: 70,
      merged_commits: 9,
      active_periods: 4,
      trend_delta: 4,
    },
  ];

  readonly friendConnections: FriendConnectionRow[] = [
    {
      requester_account_id: "account-1",
      addressee_account_id: "account-2",
      pair_key: "account-1:account-2",
      status: "ACCEPTED",
    },
  ];

  readonly friendInvites: FriendInviteRow[] = [
    {
      inviter_account_id: "account-1",
      token: "invite-token",
      created_at: Date.now() - 1_000,
      expires_at: Date.now() + 86_400_000,
      status: "PENDING",
    },
  ];

  readonly leaderboardRanks: LeaderboardRankRow[] = [
    {
      window: "30d",
      rank: 1,
      account_id: "account-1",
      vibe_score: 123,
      merged_additions: 400,
      merged_deletions: 100,
      merged_commits: 12,
      active_periods: 6,
      trend_delta: 8,
    },
    {
      window: "30d",
      rank: 2,
      account_id: "account-2",
      vibe_score: 90,
      merged_additions: 250,
      merged_deletions: 70,
      merged_commits: 9,
      active_periods: 4,
      trend_delta: 4,
    },
  ];

  readonly installationGrants: InstallationGrantRow[] = [
    {
      account_id: "account-1",
      installation_id: "installation-1",
    },
  ];

  readonly repositories: RepositoryRow[] = [
    {
      id: "repo-1",
      installation_id: "installation-1",
      owner: "octo-org",
      name: "api",
      is_private: 0,
      sync_enabled: 1,
    },
  ];

  readonly dailyStats: DailyStatRow[] = [
    {
      account_id: "account-1",
      repository_id: "repo-1",
      day_utc: new Date().toISOString().slice(0, 10),
      additions: 50,
      deletions: 10,
      merged_pr_count: 2,
      commit_count: 5,
    },
  ];

  prepare(sql: string) {
    return new FakePreparedStatement(this, sql);
  }

  first(sql: string, args: unknown[]) {
    if (sql.includes("FROM github_accounts") && sql.includes("WHERE id = ?")) {
      return (
        this.accounts.find((row) => row.id === String(args[0])) ?? null
      );
    }

    if (sql.includes("FROM github_accounts") && sql.includes("WHERE login = ?")) {
      return (
        this.accounts.find((row) => row.login === String(args[0])) ?? null
      );
    }

    if (sql.includes("FROM leaderboard_scores")) {
      return (
        this.scores.find(
          (row) =>
            row.account_id === String(args[0]) && row.window === String(args[1]),
        ) ?? null
      );
    }

    if (sql.includes("FROM leaderboard_ranks")) {
      return (
        this.leaderboardRanks.find(
          (row) =>
            row.account_id === String(args[0]) && row.window === String(args[1]),
        ) ?? null
      );
    }

    if (sql.includes("COUNT(*) AS count") && sql.includes("friend_connections")) {
      const accountId = String(args[0]);
      return {
        count: this.friendConnections.filter(
          (row) =>
            row.status === "ACCEPTED" &&
            (row.requester_account_id === accountId ||
              row.addressee_account_id === accountId),
        ).length,
      };
    }

    if (sql.includes("FROM friend_invites")) {
      return (
        this.friendInvites.find(
          (row) =>
            row.inviter_account_id === String(args[0]) &&
            row.status === "PENDING" &&
            row.expires_at > Number(args[1]),
        ) ?? null
      );
    }

    if (sql.includes("WHERE pair_key = ?")) {
      return (
        this.friendConnections.find((row) => row.pair_key === String(args[0])) ?? null
      );
    }

    if (sql.includes("COUNT(*) AS count") && sql.includes("installation_grants")) {
      const accountId = String(args[0]);
      const installationIds = new Set(
        this.installationGrants
          .filter((row) => row.account_id === accountId)
          .map((row) => row.installation_id),
      );
      return {
        count: this.repositories.filter(
          (row) => installationIds.has(row.installation_id) && row.sync_enabled === 1,
        ).length,
      };
    }

    return null;
  }

  all(sql: string, args: unknown[]) {
    if (sql.includes("FROM github_accounts") && sql.includes("LEFT JOIN leaderboard_scores")) {
      const accountId = String(args[1]);
      const window = String(args[0]) as "7d" | "30d" | "90d";
      const relatedIds = new Set([accountId]);
      for (const row of this.friendConnections) {
        if (row.status !== "ACCEPTED") {
          continue;
        }

        if (row.requester_account_id === accountId) {
          relatedIds.add(row.addressee_account_id);
        }
        if (row.addressee_account_id === accountId) {
          relatedIds.add(row.requester_account_id);
        }
      }

      return this.accounts
        .filter((row) => relatedIds.has(row.id))
        .map((row) => {
          const score = this.scores.find(
            (entry) => entry.account_id === row.id && entry.window === window,
          );
          return {
            accountId: row.id,
            login: row.login,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            vibeScore: score?.vibe_score ?? 0,
            mergedAdditions: score?.merged_additions ?? 0,
            mergedDeletions: score?.merged_deletions ?? 0,
            mergedCommits: score?.merged_commits ?? 0,
            activePeriods: score?.active_periods ?? 0,
            trendDelta: score?.trend_delta ?? 0,
          };
        });
    }

    if (sql.includes("FROM leaderboard_ranks")) {
      const window = String(args[0]) as "7d" | "30d" | "90d";
      return this.leaderboardRanks
        .filter((row) => row.window === window)
        .sort((left, right) => left.rank - right.rank)
        .map((row) => {
          const account = this.accounts.find((entry) => entry.id === row.account_id);
          return {
            rank: row.rank,
            accountId: row.account_id,
            vibeScore: row.vibe_score,
            mergedAdditions: row.merged_additions,
            mergedDeletions: row.merged_deletions,
            mergedCommits: row.merged_commits,
            activePeriods: row.active_periods,
            trendDelta: row.trend_delta,
            login: account?.login ?? "unknown",
            displayName: account?.display_name ?? null,
            avatarUrl: account?.avatar_url ?? null,
          };
        });
    }

    if (sql.includes("FROM daily_user_repo_stats")) {
      return this.dailyStats.map((row) => {
        const repository = this.repositories.find(
          (entry) => entry.id === row.repository_id,
        );
        return {
          dayUtc: row.day_utc,
          additions: row.additions,
          deletions: row.deletions,
          mergedPrCount: row.merged_pr_count,
          commitCount: row.commit_count,
          owner: repository?.owner ?? "unknown",
          name: repository?.name ?? "unknown",
          isPrivate: repository?.is_private ?? 0,
        };
      });
    }

    return [];
  }
}

function createEnv() {
  return {
    APP_URL: "https://worker.example.com",
    DB: new FakeD1Database() as unknown as D1Database,
    INTERNAL_API_TOKEN: "internal-token",
  } satisfies VibeWorkerEnv;
}

function createRequest(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as Request<
    unknown,
    IncomingRequestCfProperties<unknown>
  >;
}

describe("worker read routes", () => {
  it("returns 401 for protected reads without internal auth", async () => {
    const response = await worker.fetch(
      createRequest("https://worker.example.com/api/social/me"),
      createEnv(),
    );

    expect(response.status).toBe(401);
  });

  it("returns social me payload for internally authenticated requests", async () => {
    const response = await worker.fetch(
      createRequest("https://worker.example.com/api/social/me", {
        headers: {
          "x-vibe-internal-token": "internal-token",
          "x-vibe-account-id": "account-1",
        },
      }),
      createEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        profile: expect.objectContaining({
          login: "octocat",
        }),
        counts: expect.objectContaining({
          friendCount: 1,
          pendingInviteCount: 1,
        }),
      }),
    );
  });

  it("returns metrics payload for internally authenticated requests", async () => {
    const response = await worker.fetch(
      createRequest("https://worker.example.com/api/metrics?view=daily", {
        headers: {
          "x-vibe-internal-token": "internal-token",
          "x-vibe-account-id": "account-1",
        },
      }),
      createEnv(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        user: "@octocat",
        view: "daily",
        repositories: [
          expect.objectContaining({
            name: "octo-org/api",
          }),
        ],
      }),
    );
  });
});
