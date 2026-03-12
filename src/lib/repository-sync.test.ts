import { describe, expect, it } from "vitest";

import { getStaleRepositoryIds } from "@/lib/repository-sync";

describe("repository sync cleanup", () => {
  it("returns revoked repositories for deletion", () => {
    expect(
      getStaleRepositoryIds({
        persistedRepositories: [
          { id: "repo-1", githubRepoId: 1 },
          { id: "repo-2", githubRepoId: 2 },
          { id: "repo-3", githubRepoId: 3 },
        ],
        githubRepositoryIds: [1, 3],
      }),
    ).toEqual(["repo-2"]);
  });

  it("returns an empty list when all cached repositories are still granted", () => {
    expect(
      getStaleRepositoryIds({
        persistedRepositories: [
          { id: "repo-1", githubRepoId: 1 },
          { id: "repo-2", githubRepoId: 2 },
        ],
        githubRepositoryIds: [1, 2],
      }),
    ).toEqual([]);
  });
});
