import { describe, expect, it } from "vitest";

import { buildFriendPairKey, calculateVibeScore } from "@/lib/social";

describe("social helpers", () => {
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
});
