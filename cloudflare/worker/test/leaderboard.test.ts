import { describe, expect, it } from "vitest";

import {
  calculateVibeScore,
  rankLeaderboardEntries,
  summarizeDailyStats,
} from "@/jobs/leaderboard";

describe("leaderboard helpers", () => {
  it("calculates vibe score from shipped-work inputs", () => {
    expect(
      calculateVibeScore({
        mergedAdditions: 120,
        mergedDeletions: 40,
        mergedCommits: 5,
        activePeriods: 3,
      }),
    ).toBe(42);
  });

  it("summarizes daily stats using unique active periods", () => {
    expect(
      summarizeDailyStats([
        {
          day_utc: "2026-03-25",
          additions: 10,
          deletions: 2,
          commit_count: 1,
        },
        {
          day_utc: "2026-03-25",
          additions: 5,
          deletions: 1,
          commit_count: 2,
        },
        {
          day_utc: "2026-03-26",
          additions: 20,
          deletions: 4,
          commit_count: 3,
        },
      ]),
    ).toEqual({
      mergedAdditions: 35,
      mergedDeletions: 7,
      mergedCommits: 6,
      activePeriods: 2,
      vibeScore: 30,
    });
  });

  it("ranks higher vibe scores first and breaks ties by login", () => {
    expect(
      rankLeaderboardEntries([
        {
          accountId: "2",
          login: "zoe",
          vibeScore: 100,
          mergedAdditions: 0,
          mergedDeletions: 0,
          mergedCommits: 0,
          activePeriods: 0,
          trendDelta: 0,
        },
        {
          accountId: "1",
          login: "alex",
          vibeScore: 100,
          mergedAdditions: 0,
          mergedDeletions: 0,
          mergedCommits: 0,
          activePeriods: 0,
          trendDelta: 0,
        },
        {
          accountId: "3",
          login: "mira",
          vibeScore: 90,
          mergedAdditions: 0,
          mergedDeletions: 0,
          mergedCommits: 0,
          activePeriods: 0,
          trendDelta: 0,
        },
      ]),
    ).toEqual([
      expect.objectContaining({ accountId: "1", rank: 1 }),
      expect.objectContaining({ accountId: "2", rank: 2 }),
      expect.objectContaining({ accountId: "3", rank: 3 }),
    ]);
  });
});
