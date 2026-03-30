export type GithubStateInstallation = {
  id: string;
  githubInstallId: number;
  accountLogin: string;
  repositoryCount: number;
  trackedRepositoryCount: number;
  recommendedRepositoryCount: number;
  recommendedRepositoryIds: string[];
  repositories: Array<{
    id: string;
    name: string;
    owner: string;
    syncEnabled: boolean;
  }>;
};

export type SyncHealthSummary = {
  queuedJobs: number;
  runningJobs: number;
  completedLast24Hours: number;
  failedLast24Hours: number;
  averageDurationMs: number | null;
  latestCompletedAt: Date | null;
  latestResult: {
    selectedRepositoryCount?: number;
    skippedRepositoryCount?: number;
    syncedRepositoryCount?: number;
    processedPullRequestCount?: number;
    fetchedPullRequestCount?: number;
    githubRetryCount?: number;
    githubRetryDelayMs?: number;
    averageRepositoryDurationMs?: number;
    queueDelayMs?: number;
    durationMs?: number;
    deferredUntil?: string;
  } | null;
  latestError: string | null;
};

export type GithubState = {
  connected: boolean;
  title: string;
  description: string;
  primaryAction: {
    label: string;
    href: string;
  } | null;
  accountId: string | null;
  viewer: {
    login: string;
  } | null;
  activitySync: {
    status: string;
    updatedAt: string;
  } | null;
  activitySyncRunning: boolean;
  syncHealth: SyncHealthSummary | null;
  installations: GithubStateInstallation[];
};

type GithubStateInstallationInput = Partial<
  Omit<GithubStateInstallation, "repositories">
> & {
  repositories?: Array<
    Partial<GithubStateInstallation["repositories"][number]>
  > | null;
};

type GithubStateInput = Omit<GithubState, "installations"> & {
  installations?: GithubStateInstallationInput[] | null;
};

export function normalizeGithubState(
  input: GithubStateInput | null | undefined,
): GithubState | null {
  if (!input) {
    return null;
  }

  return {
    ...input,
    installations: (input.installations ?? []).map((installation) => {
      const repositories = (installation.repositories ?? []).flatMap((repository) => {
        if (!repository?.id || !repository.name || !repository.owner) {
          return [];
        }

        return [
          {
            id: repository.id,
            name: repository.name,
            owner: repository.owner,
            syncEnabled: Boolean(repository.syncEnabled),
          },
        ];
      });
      const recommendedRepositoryIds = Array.isArray(
        installation.recommendedRepositoryIds,
      )
        ? installation.recommendedRepositoryIds.filter(
            (repositoryId): repositoryId is string =>
              typeof repositoryId === "string" && repositoryId.length > 0,
          )
        : [];

      return {
        id: installation.id ?? "",
        githubInstallId: installation.githubInstallId ?? 0,
        accountLogin: installation.accountLogin ?? "",
        repositoryCount: installation.repositoryCount ?? repositories.length,
        trackedRepositoryCount:
          installation.trackedRepositoryCount ??
          repositories.filter((repository) => repository.syncEnabled).length,
        recommendedRepositoryCount:
          installation.recommendedRepositoryCount ??
          recommendedRepositoryIds.length,
        recommendedRepositoryIds,
        repositories,
      };
    }),
  };
}
