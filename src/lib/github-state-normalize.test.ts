import { describe, expect, it } from "vitest";

import { normalizeGithubState } from "@/lib/github-state-normalize";

describe("normalizeGithubState", () => {
  it("defaults missing recommended repository ids to an empty list", () => {
    const normalized = normalizeGithubState({
      connected: true,
      title: "GitHub is connected",
      description: "desc",
      primaryAction: null,
      accountId: "acct_123",
      viewer: { login: "max" },
      activitySync: null,
      activitySyncRunning: false,
      syncHealth: null,
      installations: [
        {
          id: "inst_123",
          githubInstallId: 99,
          accountLogin: "max-org",
          repositoryCount: 2,
          trackedRepositoryCount: 1,
          repositories: [
            {
              id: "repo_1",
              name: "vibe-tracker",
              owner: "max",
              syncEnabled: true,
            },
            {
              id: "repo_2",
              name: "worker",
              owner: "max",
              syncEnabled: false,
            },
          ],
        },
      ],
    });

    expect(normalized?.installations[0]?.recommendedRepositoryIds).toEqual([]);
    expect(normalized?.installations[0]?.recommendedRepositoryCount).toBe(0);
  });

  it("filters invalid repository rows instead of surfacing a crashable payload", () => {
    const normalized = normalizeGithubState({
      connected: true,
      title: "GitHub is connected",
      description: "desc",
      primaryAction: null,
      accountId: "acct_123",
      viewer: { login: "max" },
      activitySync: null,
      activitySyncRunning: false,
      syncHealth: null,
      installations: [
        {
          id: "inst_123",
          githubInstallId: 99,
          accountLogin: "max-org",
          repositories: [
            {
              id: "repo_1",
              name: "vibe-tracker",
              owner: "max",
              syncEnabled: true,
            },
            {
              id: "repo_2",
              owner: "max",
            },
          ],
        },
      ],
    });

    expect(normalized?.installations[0]?.repositories).toEqual([
      {
        id: "repo_1",
        name: "vibe-tracker",
        owner: "max",
        syncEnabled: true,
      },
    ]);
    expect(normalized?.installations[0]?.repositoryCount).toBe(1);
    expect(normalized?.installations[0]?.trackedRepositoryCount).toBe(1);
  });
});
