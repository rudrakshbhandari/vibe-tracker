import type { LeaderboardWindow } from "@/jobs/contracts";
import type { VibeWorkerEnv } from "@/env";

type DailyStatRow = {
  day_utc: string;
  additions: number;
  deletions: number;
  commit_count: number;
};

type LeaderboardScoreEntry = {
  accountId: string;
  login: string;
  vibeScore: number;
  mergedAdditions: number;
  mergedDeletions: number;
  mergedCommits: number;
  activePeriods: number;
  trendDelta: number;
};

type ScoreTotals = {
  vibeScore: number;
  mergedAdditions: number;
  mergedDeletions: number;
  mergedCommits: number;
  activePeriods: number;
};

const WINDOW_DAYS: Record<LeaderboardWindow, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const STALE_SYNC_JOB_MINUTES = 60;

function getUtcDayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftUtcDays(day: string, deltaDays: number) {
  const value = new Date(`${day}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + deltaDays);
  return getUtcDayString(value);
}

function getWindowStartDay(window: LeaderboardWindow, now: Date) {
  return shiftUtcDays(getUtcDayString(now), -WINDOW_DAYS[window]);
}

export function calculateVibeScore(input: Omit<ScoreTotals, "vibeScore">) {
  const weightedTotal =
    input.mergedAdditions +
    Math.round(input.mergedDeletions * 0.7) +
    input.mergedCommits * 28 +
    input.activePeriods * 45;

  return Math.max(0, Math.round(weightedTotal / 10));
}

export function summarizeDailyStats(rows: DailyStatRow[]): ScoreTotals {
  const days = new Set(rows.map((row) => row.day_utc));
  const mergedAdditions = rows.reduce((sum, row) => sum + row.additions, 0);
  const mergedDeletions = rows.reduce((sum, row) => sum + row.deletions, 0);
  const mergedCommits = rows.reduce((sum, row) => sum + row.commit_count, 0);
  const activePeriods = days.size;

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

export function rankLeaderboardEntries(entries: LeaderboardScoreEntry[]) {
  return [...entries]
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

async function getDailyStatsForRange(input: {
  env: VibeWorkerEnv;
  accountId: string;
  startDay: string;
  endDay?: string;
}) {
  const whereEnd = input.endDay ? " AND day_utc < ?" : "";
  const statement = input.env.DB.prepare(
    `SELECT day_utc, additions, deletions, commit_count
     FROM daily_user_repo_stats
     WHERE account_id = ? AND day_utc >= ?${whereEnd}`,
  );

  const result = input.endDay
    ? await statement.bind(input.accountId, input.startDay, input.endDay).all<DailyStatRow>()
    : await statement.bind(input.accountId, input.startDay).all<DailyStatRow>();

  return result.results ?? [];
}

async function upsertLeaderboardScore(input: {
  env: VibeWorkerEnv;
  accountId: string;
  window: LeaderboardWindow;
  totals: ScoreTotals;
  trendDelta: number;
  calculatedAt: number;
}) {
  return input.env.DB.prepare(
    `INSERT INTO leaderboard_scores (
      account_id,
      window,
      vibe_score,
      merged_additions,
      merged_deletions,
      merged_commits,
      active_periods,
      trend_delta,
      calculated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, window) DO UPDATE SET
      vibe_score = excluded.vibe_score,
      merged_additions = excluded.merged_additions,
      merged_deletions = excluded.merged_deletions,
      merged_commits = excluded.merged_commits,
      active_periods = excluded.active_periods,
      trend_delta = excluded.trend_delta,
      calculated_at = excluded.calculated_at`,
  )
    .bind(
      input.accountId,
      input.window,
      input.totals.vibeScore,
      input.totals.mergedAdditions,
      input.totals.mergedDeletions,
      input.totals.mergedCommits,
      input.totals.activePeriods,
      input.trendDelta,
      input.calculatedAt,
    )
    .run();
}

export async function recomputeLeaderboardScoresForAccount(
  env: VibeWorkerEnv,
  accountId: string,
  windows?: LeaderboardWindow[],
  now = new Date(),
) {
  const targetWindows = windows ?? (["7d", "30d", "90d"] as LeaderboardWindow[]);
  const calculatedAt = now.getTime();

  for (const window of targetWindows) {
    const currentStart = getWindowStartDay(window, now);
    const previousStart = shiftUtcDays(currentStart, -WINDOW_DAYS[window]);
    const currentRows = await getDailyStatsForRange({
      env,
      accountId,
      startDay: currentStart,
    });
    const previousRows = await getDailyStatsForRange({
      env,
      accountId,
      startDay: previousStart,
      endDay: currentStart,
    });

    const totals = summarizeDailyStats(currentRows);
    const previousTotals = summarizeDailyStats(previousRows);

    await upsertLeaderboardScore({
      env,
      accountId,
      window,
      totals,
      trendDelta: totals.vibeScore - previousTotals.vibeScore,
      calculatedAt,
    });
  }
}

export async function rebuildLeaderboardRanks(
  env: VibeWorkerEnv,
  window: LeaderboardWindow,
  now = new Date(),
) {
  const result = await env.DB.prepare(
    `SELECT
      leaderboard_scores.account_id AS accountId,
      github_accounts.login AS login,
      leaderboard_scores.vibe_score AS vibeScore,
      leaderboard_scores.merged_additions AS mergedAdditions,
      leaderboard_scores.merged_deletions AS mergedDeletions,
      leaderboard_scores.merged_commits AS mergedCommits,
      leaderboard_scores.active_periods AS activePeriods,
      leaderboard_scores.trend_delta AS trendDelta
     FROM leaderboard_scores
     INNER JOIN github_accounts
       ON github_accounts.id = leaderboard_scores.account_id
     WHERE leaderboard_scores.window = ?
       AND github_accounts.leaderboard_visibility = 'PUBLIC'`,
  )
    .bind(window)
    .all<LeaderboardScoreEntry>();

  const rankedEntries = rankLeaderboardEntries(result.results ?? []);

  await env.DB.prepare("DELETE FROM leaderboard_ranks WHERE window = ?")
    .bind(window)
    .run();

  if (rankedEntries.length === 0) {
    return;
  }

  const calculatedAt = now.getTime();
  await env.DB.batch(
    rankedEntries.map((entry) =>
      env.DB.prepare(
        `INSERT INTO leaderboard_ranks (
          window,
          rank,
          account_id,
          vibe_score,
          merged_additions,
          merged_deletions,
          merged_commits,
          active_periods,
          trend_delta,
          calculated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        window,
        entry.rank,
        entry.accountId,
        entry.vibeScore,
        entry.mergedAdditions,
        entry.mergedDeletions,
        entry.mergedCommits,
        entry.activePeriods,
        entry.trendDelta,
        calculatedAt,
      ),
    ),
  );
}

export async function cleanupExpiredFriendInvites(env: VibeWorkerEnv, now = new Date()) {
  await env.DB.prepare(
    `UPDATE friend_invites
     SET status = 'EXPIRED', updated_at = ?
     WHERE status = 'PENDING' AND expires_at <= ?`,
  )
    .bind(now.getTime(), now.getTime())
    .run();
}

export async function failStaleSyncJobs(env: VibeWorkerEnv, now = new Date()) {
  const staleBefore = now.getTime() - STALE_SYNC_JOB_MINUTES * 60 * 1000;
  await env.DB.prepare(
    `UPDATE sync_jobs
     SET status = 'failed',
         finished_at = ?,
         lease_token = NULL,
         lease_expires_at = NULL,
         error_message = 'Marked stale after exceeding the Cloudflare maintenance window.',
         updated_at = ?
     WHERE status IN ('queued', 'running')
       AND updated_at < ?`,
  )
    .bind(now.getTime(), now.getTime(), staleBefore)
    .run();
}

export async function runMaintenance(env: VibeWorkerEnv, now = new Date()) {
  await cleanupExpiredFriendInvites(env, now);
  await failStaleSyncJobs(env, now);

  for (const window of ["7d", "30d", "90d"] as LeaderboardWindow[]) {
    await rebuildLeaderboardRanks(env, window, now);
  }
}
