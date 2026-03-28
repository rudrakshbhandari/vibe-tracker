import type { VibeWorkerEnv } from "@/env";

export const metricsViewValues = ["daily", "weekly", "monthly"] as const;

type MetricsView = (typeof metricsViewValues)[number];

type TimelineBucket = {
  label: string;
  start: Date;
  end: Date;
  additions: number;
  deletions: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function createFormatter(view: MetricsView) {
  if (view === "monthly") {
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
}

function getViewConfig(view: MetricsView) {
  if (view === "daily") {
    return {
      title: "Daily shipped work",
      bucketCount: 14,
      stepDays: 1,
      filterLabel: "Last 14 days",
    };
  }

  if (view === "weekly") {
    return {
      title: "Weekly shipped work",
      bucketCount: 12,
      stepDays: 7,
      filterLabel: "Last 12 weeks",
    };
  }

  return {
    title: "Monthly shipped work",
    bucketCount: 12,
    stepDays: 30,
    filterLabel: "Last 12 months",
  };
}

function buildTimelineBuckets(view: MetricsView) {
  const config = getViewConfig(view);
  const formatter = createFormatter(view);

  if (view === "monthly") {
    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    return Array.from({ length: config.bucketCount }, (_, index) => {
      const monthOffset = config.bucketCount - index - 1;
      const start = new Date(
        Date.UTC(
          currentMonthStart.getUTCFullYear(),
          currentMonthStart.getUTCMonth() - monthOffset,
          1,
        ),
      );
      const end = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
      );

      return {
        label: formatter.format(start),
        start,
        end,
        additions: 0,
        deletions: 0,
      } satisfies TimelineBucket;
    });
  }

  const totalDays = config.bucketCount * config.stepDays;
  const start = new Date(Date.now() - totalDays * 24 * 60 * 60 * 1000);

  return Array.from({ length: config.bucketCount }, (_, index) => {
    const bucketStart = new Date(
      start.getTime() + index * config.stepDays * 24 * 60 * 60 * 1000,
    );
    const bucketEnd = new Date(
      bucketStart.getTime() + config.stepDays * 24 * 60 * 60 * 1000,
    );

    return {
      label: formatter.format(bucketStart),
      start: bucketStart,
      end: bucketEnd,
      additions: 0,
      deletions: 0,
    } satisfies TimelineBucket;
  });
}

function getStartDay(view: MetricsView) {
  const firstBucket = buildTimelineBuckets(view)[0];
  return firstBucket?.start.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10);
}

export async function getMetricsResponse(
  env: VibeWorkerEnv,
  accountId: string,
  view: MetricsView = "daily",
) {
  const profile = await env.DB.prepare(
    `SELECT login
     FROM github_accounts
     WHERE id = ?`,
  )
    .bind(accountId)
    .first<{ login: string }>();

  if (!profile) {
    throw new Error("Account not found");
  }

  const trackedRepoCountResult = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM repositories
     INNER JOIN installation_grants
       ON installation_grants.installation_id = repositories.installation_id
     WHERE installation_grants.account_id = ?
       AND repositories.sync_enabled = 1`,
  )
    .bind(accountId)
    .first<{ count: number }>();

  const trackedRepoCount = Number(trackedRepoCountResult?.count ?? 0);
  const timeline = buildTimelineBuckets(view);

  if (trackedRepoCount === 0) {
    return {
      user: `@${profile.login}`,
      profile: {
        login: `@${profile.login}`,
        source: "live" as const,
      },
      view,
      mode: "shipped",
      generatedAt: new Date().toISOString(),
      filters: [getViewConfig(view).filterLabel, "Shipped work"],
      summary: [
        {
          label: "Lines shipped",
          value: "+0",
          detail: "Install the GitHub App on a scope to pull repository access.",
        },
        {
          label: "Lines removed",
          value: "-0",
          detail: "No repositories are connected yet.",
        },
        {
          label: "Merged PRs",
          value: "0",
          detail: "Shipped-work totals appear after the first merged-PR sync.",
        },
        {
          label: "Latest sync",
          value: "Not started",
          detail: "Run your first shipped-work sync to replace sample metrics.",
        },
      ],
      timeline: timeline.map((bucket) => ({
        label: bucket.label,
        additions: 0,
        deletions: 0,
        additionsHeight: 0,
        deletionsHeight: 0,
      })),
      repositories: [],
      chartTitle: getViewConfig(view).title,
      activitySyncRunning: false,
      syncHealth: null,
    };
  }

  const rows = await env.DB.prepare(
    `SELECT
      daily_user_repo_stats.day_utc AS dayUtc,
      daily_user_repo_stats.additions AS additions,
      daily_user_repo_stats.deletions AS deletions,
      daily_user_repo_stats.merged_pr_count AS mergedPrCount,
      daily_user_repo_stats.commit_count AS commitCount,
      repositories.owner AS owner,
      repositories.name AS name,
      repositories.is_private AS isPrivate
     FROM daily_user_repo_stats
     INNER JOIN repositories
       ON repositories.id = daily_user_repo_stats.repository_id
     WHERE daily_user_repo_stats.account_id = ?
       AND daily_user_repo_stats.day_utc >= ?`,
  )
    .bind(accountId, getStartDay(view))
    .all<{
      dayUtc: string;
      additions: number;
      deletions: number;
      mergedPrCount: number;
      commitCount: number;
      owner: string;
      name: string;
      isPrivate: number;
    }>();

  const resultRows = rows.results ?? [];
  const repositoryMap = new Map<
    string,
    {
      name: string;
      detail: string;
      visibility: string;
      additions: number;
      deletions: number;
      commitCount: number;
      mergedPrCount: number;
    }
  >();

  let totalAdditions = 0;
  let totalDeletions = 0;
  let totalMergedPrs = 0;
  let totalCommits = 0;
  let latestDay = "";

  for (const row of resultRows) {
    totalAdditions += row.additions;
    totalDeletions += row.deletions;
    totalMergedPrs += row.mergedPrCount;
    totalCommits += row.commitCount;
    if (row.dayUtc > latestDay) {
      latestDay = row.dayUtc;
    }

    const statDate = new Date(`${row.dayUtc}T00:00:00.000Z`);
    const bucket = timeline.find((entry) => statDate >= entry.start && statDate < entry.end);
    if (bucket) {
      bucket.additions += row.additions;
      bucket.deletions += row.deletions;
    }

    const repoKey = `${row.owner}/${row.name}`;
    const existing = repositoryMap.get(repoKey) ?? {
      name: repoKey,
      detail: "",
      visibility: row.isPrivate === 1 ? "private" : "public",
      additions: 0,
      deletions: 0,
      commitCount: 0,
      mergedPrCount: 0,
    };
    existing.additions += row.additions;
    existing.deletions += row.deletions;
    existing.commitCount += row.commitCount;
    existing.mergedPrCount += row.mergedPrCount;
    repositoryMap.set(repoKey, existing);
  }

  const maxValue = Math.max(
    1,
    ...timeline.flatMap((bucket) => [bucket.additions, bucket.deletions]),
  );

  return {
    user: `@${profile.login}`,
    profile: {
      login: `@${profile.login}`,
      source: "live" as const,
    },
    view,
    mode: "shipped",
    generatedAt: new Date().toISOString(),
    filters: [
      getViewConfig(view).filterLabel,
      "Shipped work",
      "Merged PRs only",
      `${trackedRepoCount} tracked repos`,
    ],
    summary: [
      {
        label: "Lines shipped",
        value: `+${formatNumber(totalAdditions)}`,
        detail: `From ${formatNumber(totalMergedPrs)} merged pull requests in the selected view.`,
      },
      {
        label: "Lines removed",
        value: `-${formatNumber(totalDeletions)}`,
        detail: "Measured when the pull request merged, not from branch recrawls.",
      },
      {
        label: "Merged PRs",
        value: formatNumber(totalMergedPrs),
        detail: `Across ${formatNumber(totalCommits)} shipped commits in the selected window.`,
      },
      {
        label: "Latest sync",
        value: latestDay ? "Ready" : "Not started",
        detail: latestDay
          ? `Updated ${new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
            }).format(new Date(`${latestDay}T00:00:00.000Z`))}`
          : "Run your first shipped-work sync to replace sample metrics.",
      },
    ],
    timeline: timeline.map((bucket) => ({
      label: bucket.label,
      additions: bucket.additions,
      deletions: bucket.deletions,
      additionsHeight: Math.round((bucket.additions / maxValue) * 100),
      deletionsHeight: Math.round((bucket.deletions / maxValue) * 100),
    })),
    repositories: Array.from(repositoryMap.values())
      .sort((left, right) => right.additions - left.additions)
      .slice(0, 6)
      .map((repository) => ({
        ...repository,
        detail: `${formatNumber(repository.mergedPrCount)} merged PRs in the selected window.`,
      })),
    chartTitle: getViewConfig(view).title,
    activitySyncRunning: false,
    syncHealth: null,
  };
}
