import { db } from "@/lib/db";
import { formatNumber } from "@/lib/dashboard";
import type { AnalyticsView, MetricMode } from "@/lib/dashboard";
import { hasDurableDatabaseUrl } from "@/lib/env";
import { getOptionalUserSession } from "@/lib/session";

type TimelineBucket = {
  label: string;
  start: Date;
  end: Date;
  additions: number;
  deletions: number;
};

function getViewConfig(view: AnalyticsView) {
  if (view === "daily") {
    return {
      title: "Daily activity",
      bucketCount: 14,
      stepDays: 1,
      filterLabel: "Last 14 days",
      formatter: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }),
    };
  }

  if (view === "weekly") {
    return {
      title: "Weekly activity",
      bucketCount: 12,
      stepDays: 7,
      filterLabel: "Last 12 weeks",
      formatter: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }),
    };
  }

  return {
    title: "Monthly activity",
    bucketCount: 12,
    stepDays: 30,
    filterLabel: "Last 12 months",
    formatter: new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
    }),
  };
}

function buildTimelineBuckets(view: AnalyticsView) {
  const config = getViewConfig(view);
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

function getWindowStart(view: AnalyticsView) {
  const firstBucket = buildTimelineBuckets(view)[0];
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
          status: "running",
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

  if (installationIds.length === 0) {
    return {
      profile: {
        login: `@${session.account.login}`,
        source: "live" as const,
      },
      filters: [
        getViewConfig(view).filterLabel,
        mode === "authored" ? "Authored commits" : "Merged to default branch",
      ],
      summary: [
        {
          label: "Lines added",
          value: "+0",
          detail: "Install the GitHub App on a scope to pull repository access.",
        },
        {
          label: "Lines deleted",
          value: "-0",
          detail: "No repositories are connected yet.",
        },
        {
          label: "Tracked repos",
          value: "0",
          detail: "Repository grants appear here right after installation.",
        },
        {
          label: "Latest sync",
          value: "Not started",
          detail: "Run the activity sync once the installation is connected.",
        },
      ],
      timeline: buildTimelineBuckets(view).map((bucket) => ({
        label: bucket.label,
        additions: 0,
        deletions: 0,
        additionsHeight: 0,
        deletionsHeight: 0,
      })),
      repositories: [],
      chartTitle: getViewConfig(view).title,
    };
  }

  const commits = await db.commit.findMany({
    where: {
      repository: {
        installationId: {
          in: installationIds,
        },
      },
      authorId: session.accountId,
      authoredAt: {
        gte: getWindowStart(view),
      },
      ...(mode === "merged" ? { mergedToDefaultBranch: true } : {}),
    },
    include: {
      repository: true,
      branchLinks: {
        include: {
          branch: true,
        },
      },
      pullRequestLinks: {
        include: {
          pullRequest: true,
        },
      },
    },
    orderBy: {
      authoredAt: "desc",
    },
  });

  const totals = commits.reduce(
    (accumulator, commit) => ({
      additions: accumulator.additions + commit.additions,
      deletions: accumulator.deletions + commit.deletions,
    }),
    { additions: 0, deletions: 0 },
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
    }
  >();

  const timeline = buildTimelineBuckets(view);

  for (const commit of commits) {
    const key = commit.repositoryId;
    const existing = repositoryMap.get(key) ?? {
      name: `${commit.repository.owner}/${commit.repository.name}`,
      detail:
        commit.pullRequestLinks[0]?.pullRequest.title ??
        `${commit.branchLinks.length} branch refs captured`,
      visibility: commit.repository.isPrivate ? "private" : "public",
      additions: 0,
      deletions: 0,
      commitCount: 0,
    };

    existing.additions += commit.additions;
    existing.deletions += commit.deletions;
    existing.commitCount += 1;
    repositoryMap.set(key, existing);

    const bucket = timeline.find(
      (item) => commit.authoredAt >= item.start && commit.authoredAt < item.end,
    );
    if (bucket) {
      bucket.additions += commit.additions;
      bucket.deletions += commit.deletions;
    }
  }

  const maxValue = Math.max(
    1,
    ...timeline.flatMap((item) => [item.additions, item.deletions]),
  );

  const installationRepoCount = await db.repository.count({
    where: {
      installationId: {
        in: installationIds,
      },
    },
  });

  return {
    profile: {
      login: `@${session.account.login}`,
      source: "live" as const,
    },
    filters: [
      getViewConfig(view).filterLabel,
      mode === "authored" ? "Authored commits" : "Merged to default branch",
      "Deduped by repo + SHA",
      `${installationRepoCount} tracked repos`,
    ],
    summary: [
      {
        label: "Lines added",
        value: `+${formatNumber(totals.additions)}`,
        detail: `From ${formatNumber(commits.length)} authored commits in the selected view.`,
      },
      {
        label: "Lines deleted",
        value: `-${formatNumber(totals.deletions)}`,
        detail: "Counted once even if the same commit appears on multiple branches.",
      },
      {
        label: "Tracked repos",
        value: formatNumber(installationRepoCount),
        detail: "Repositories granted through your current GitHub App installations.",
      },
      {
        label: "Latest sync",
        value: runningActivitySync ? "Running" : "Ready",
        detail: (runningActivitySync ?? latestActivitySync)?.updatedAt
          ? `Updated ${new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format((runningActivitySync ?? latestActivitySync)!.updatedAt)}`
          : "Run your first activity sync to replace demo metrics.",
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
      .slice(0, 6),
    chartTitle: getViewConfig(view).title,
    activitySyncRunning: Boolean(runningActivitySync),
  };
}
