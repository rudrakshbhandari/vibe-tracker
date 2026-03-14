export type TimeWindow = "7d" | "30d" | "90d";
export type MetricMode = "shipped";
export type AnalyticsView = "daily" | "weekly" | "monthly";

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getSampleSeries(view: AnalyticsView) {
  if (view === "daily") {
    return {
      labels: [
        "Mar 1",
        "Mar 2",
        "Mar 3",
        "Mar 4",
        "Mar 5",
        "Mar 6",
        "Mar 7",
        "Mar 8",
        "Mar 9",
        "Mar 10",
        "Mar 11",
        "Mar 12",
        "Mar 13",
        "Mar 14",
      ],
      additions: [18, 24, 34, 12, 52, 60, 28, 22, 40, 74, 66, 48, 39, 68],
      deletions: [7, 9, 12, 5, 18, 21, 11, 8, 14, 29, 24, 17, 13, 25],
      chartTitle: "Daily shipped work",
      filter: "Last 14 days",
    };
  }

  if (view === "monthly") {
    return {
      labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
      additions: [760, 980, 620, 1120, 940, 1080, 1310, 1260, 1010, 1430, 1580, 1390],
      deletions: [240, 310, 190, 410, 320, 360, 470, 430, 350, 520, 560, 505],
      chartTitle: "Monthly shipped work",
      filter: "Last 12 months",
    };
  }

  return {
    labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"],
    additions: [110, 150, 210, 410, 280, 560, 360, 640, 420, 510, 490, 710],
    deletions: [50, 72, 96, 138, 120, 220, 176, 264, 184, 210, 204, 288],
    chartTitle: "Weekly shipped work",
    filter: "Last 12 weeks",
  };
}

export function getDashboardData(view: AnalyticsView = "weekly") {
  const series = getSampleSeries(view);
  const maxValue = Math.max(...series.additions, ...series.deletions);
  const totalAdditions = series.additions.reduce((sum, value) => sum + value, 0);
  const totalDeletions = series.deletions.reduce((sum, value) => sum + value, 0);
  const totalMergedPrs = series.additions.reduce(
    (sum, value, index) => sum + Math.max(1, Math.round((value + series.deletions[index]) / 160)),
    0,
  );

  return {
    profile: {
      login: "@rudraksh",
      source: "sample" as const,
    },
    filters: [series.filter, "Shipped work", "Merged PRs", "All installed repos"],
    summary: [
      {
        label: "Lines shipped",
        value: `+${formatNumber(totalAdditions)}`,
        detail: "From sample merged pull requests that landed on default branches.",
      },
      {
        label: "Lines removed",
        value: `-${formatNumber(totalDeletions)}`,
        detail: "Measured at merge time so the dashboard stays aggregate-first.",
      },
      {
        label: "Merged PRs",
        value: formatNumber(totalMergedPrs),
        detail: "Each merged pull request contributes once to the shipped-work totals.",
      },
      {
        label: "Open sync lag",
        value: "3m",
        detail: "Incremental sync keeps refresh cost low and avoids full history recrawls.",
      },
    ],
    timeline: series.additions.map((value, index) => ({
      label: series.labels[index],
      additions: value,
      deletions: series.deletions[index],
      additionsHeight: Math.round((value / maxValue) * 100),
      deletionsHeight: Math.round((series.deletions[index] / maxValue) * 100),
    })),
    chartTitle: series.chartTitle,
    repositories: [
      {
        name: "vibe-tracker/web",
        detail: "Most shipped work landed here in the selected sample window.",
        visibility: "private",
        additions: 1120,
        deletions: 430,
        commitCount: 11,
      },
      {
        name: "vibe-tracker/worker",
        detail: "Background jobs and shipped-work sync orchestration.",
        visibility: "private",
        additions: 830,
        deletions: 320,
        commitCount: 8,
      },
      {
        name: "shared/github-client",
        detail: "Shared API wrapper updates that reached the default branch.",
        visibility: "internal",
        additions: 560,
        deletions: 240,
        commitCount: 6,
      },
    ],
  };
}
