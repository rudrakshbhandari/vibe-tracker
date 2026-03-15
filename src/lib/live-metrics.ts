import { db } from "@/lib/db";
import { formatNumber } from "@/lib/dashboard";
import type { AnalyticsView, MetricMode } from "@/lib/dashboard";
import { hasDurableDatabaseUrl } from "@/lib/env";
import { formatDate, getUserTimezone } from "@/lib/format-date";
import { getOptionalUserSession } from "@/lib/session";

type TimelineBucket = {
  label: string;
  start: Date;
  end: Date;
  additions: number;
  deletions: number;
};

function createFormatter(
  opts: Intl.DateTimeFormatOptions,
  withTimezone: Record<string, unknown>,
): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, ...withTimezone });
  } catch {
    return new Intl.DateTimeFormat("en-US", opts);
  }
}

function getViewConfig(
  view: AnalyticsView,
  timeZone?: string,
) {
  const baseOpts = { ...(timeZone && { timeZone }) };
  if (view === "daily") {
    return {
      title: "Daily shipped work",
      bucketCount: 14,
      stepDays: 1,
      filterLabel: "Last 14 days",
      formatter: createFormatter(
        { month: "short", day: "numeric" },
        baseOpts,
      ),
    };
  }

  if (view === "weekly") {
    return {
      title: "Weekly shipped work",
      bucketCount: 12,
      stepDays: 7,
      filterLabel: "Last 12 weeks",
      formatter: createFormatter(
        { month: "short", day: "numeric" },
        baseOpts,
      ),
    };
  }

  return {
    title: "Monthly shipped work",
    bucketCount: 12,
    stepDays: 30,
    filterLabel: "Last 12 months",
    formatter: createFormatter(
      { month: "short", year: "2-digit" },
      baseOpts,
    ),
  };
}

function buildTimelineBuckets(view: AnalyticsView, timeZone?: string) {
  const config = getViewConfig(view, timeZone);

  if (view === "monthly") {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return Array.from({ length: config.bucketCount }, (_, index) => {
      const monthOffset = config.bucketCount - index - 1;
      const bucketStart = new Date(
        currentMonthStart.getFullYear(),
        currentMonthStart.getMonth() - monthOffset,
        1,
      );
      const bucketEnd = new Date(
        bucketStart.getFullYear(),
        bucketStart.getMonth() + 1,
        1,
      );

      return {
        label: config.formatter.format(bucketStart),
        start: bucketStart,
        end: bucketEnd,
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
      label: config.formatter.format(bucketStart),
      start: bucketStart,
      end: bucketEnd,
      additions: 0,
      deletions: 0,
    } satisfies TimelineBucket;
  });
}

function getWindowStart(view: AnalyticsView, timeZone?: string) {
  const firstBucket = buildTimelineBuckets(view, timeZone)[0];
  return firstBucket?.start ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
}

export async function getLiveMetrics(view: AnalyticsView, mode: MetricMode) {
  if (!hasDurableDatabaseUrl()) {
    return null;
  }

  const session = await getOptionalUserSession();

  if (!session) {
    return null;
  }

  const installationIds = session.account.installationGrants.map(
    (grant) => grant.installation.id,
  );

  const runningActivitySync = installationIds.length
    ? await db.syncJob.findFirst({
        where: {
          installationId: {
            in: installationIds,
          },
          scope: "activity",
          status: {
            in: ["queued", "running"],
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      })
    : null;

  const latestActivitySync = installationIds.length
    ? await db.syncJob.findFirst({
        where: {
          installationId: {
            in: installationIds,
          },
          scope: "activity",
        },
        orderBy: {
          updatedAt: "desc",
        },
      })
    : null;

  const timeZone = await getUserTimezone();

  if (installationIds.length === 0) {
    return {
      profile: {
        login: `@${session.account.login}`,
        source: "live" as const,
      },
    filters: [getViewConfig(view, timeZone).filterLabel, "Shipped work"],
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
          detail: "Run the shipped-work sync once the installation is connected.",
        },
      ],
      timeline: buildTimelineBuckets(view, timeZone).map((bucket) => ({
        label: bucket.label,
        additions: 0,
        deletions: 0,
        additionsHeight: 0,
        deletionsHeight: 0,
      })),
      repositories: [],
      chartTitle: getViewConfig(view, timeZone).title,
    };
  }

  const windowStart = getWindowStart(view, timeZone);
  const dailyStats = await db.dailyUserRepoStats.findMany({
    where: {
      accountId: session.accountId,
      repository: {
        installationId: {
          in: installationIds,
        },
      },
      day: {
        gte: windowStart,
      },
    },
    include: {
      repository: true,
    },
    orderBy: {
      day: "desc",
    },
  });

  const timeline = buildTimelineBuckets(view, timeZone);
  const installationRepoCount = await db.repository.count({
    where: {
      installationId: {
        in: installationIds,
      },
    },
  });

  const totals = dailyStats.reduce(
    (accumulator, stat) => ({
      additions: accumulator.additions + stat.additions,
      deletions: accumulator.deletions + stat.deletions,
      mergedPrCount: accumulator.mergedPrCount + stat.mergedPrCount,
      commitCount: accumulator.commitCount + stat.commitCount,
    }),
    { additions: 0, deletions: 0, mergedPrCount: 0, commitCount: 0 },
  );

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

  for (const stat of dailyStats) {
    const existing = repositoryMap.get(stat.repositoryId) ?? {
      name: `${stat.repository.owner}/${stat.repository.name}`,
      detail: "Merged pull requests landed on the default branch in this window.",
      visibility: stat.repository.isPrivate ? "private" : "public",
      additions: 0,
      deletions: 0,
      commitCount: 0,
      mergedPrCount: 0,
    };

    existing.additions += stat.additions;
    existing.deletions += stat.deletions;
    existing.commitCount += stat.commitCount;
    existing.mergedPrCount += stat.mergedPrCount;
    repositoryMap.set(stat.repositoryId, existing);

    const bucket = timeline.find(
      (item) => stat.day >= item.start && stat.day < item.end,
    );
    if (bucket) {
      bucket.additions += stat.additions;
      bucket.deletions += stat.deletions;
    }
  }

  const maxValue = Math.max(
    1,
    ...timeline.flatMap((item) => [item.additions, item.deletions]),
  );

  const latestPullRequest = await db.pullRequest.findFirst({
    where: {
      authorId: session.accountId,
      repository: {
        installationId: {
          in: installationIds,
        },
      },
      mergedAt: {
        gte: windowStart,
      },
    },
    include: {
      repository: true,
    },
    orderBy: {
      mergedAt: "desc",
    },
  });

  return {
    profile: {
      login: `@${session.account.login}`,
      source: "live" as const,
    },
    filters: [
      getViewConfig(view, timeZone).filterLabel,
      mode === "shipped" ? "Shipped work" : "Shipped work",
      "Merged PRs only",
      `${installationRepoCount} tracked repos`,
    ],
    summary: [
      {
        label: "Lines shipped",
        value: `+${formatNumber(totals.additions)}`,
        detail: `From ${formatNumber(totals.mergedPrCount)} merged pull requests in the selected view.`,
      },
      {
        label: "Lines removed",
        value: `-${formatNumber(totals.deletions)}`,
        detail: "Measured when the pull request merged, not from branch recrawls.",
      },
      {
        label: "Merged PRs",
        value: formatNumber(totals.mergedPrCount),
        detail: `Across ${formatNumber(totals.commitCount)} shipped commits in the selected window.`,
      },
      {
        label: "Latest sync",
        value: runningActivitySync ? "Running" : "Ready",
        detail: (runningActivitySync ?? latestActivitySync)?.updatedAt
          ? `Updated ${await formatDate(
              (runningActivitySync ?? latestActivitySync)!.updatedAt,
              {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              },
            )}`
          : "Run your first shipped-work sync to replace sample metrics.",
      },
    ],
    timeline: timeline.map((item) => ({
      label: item.label,
      additions: item.additions,
      deletions: item.deletions,
      additionsHeight: Math.round((item.additions / maxValue) * 100),
      deletionsHeight: Math.round((item.deletions / maxValue) * 100),
    })),
    repositories: Array.from(repositoryMap.values())
      .sort((left, right) => right.additions - left.additions)
      .slice(0, 6)
      .map((repository) => ({
        ...repository,
        detail: `${formatNumber(repository.mergedPrCount)} merged PRs in the selected window.`,
      })),
    chartTitle: getViewConfig(view, timeZone).title,
    latestPullRequestTitle: latestPullRequest
      ? `${latestPullRequest.repository.owner}/${latestPullRequest.repository.name}: ${latestPullRequest.title}`
      : null,
    activitySyncRunning: Boolean(runningActivitySync),
  };
}
