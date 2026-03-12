import {
  Clock3,
  GitBranch,
  GitPullRequest,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

export type TimeWindow = "7d" | "30d" | "90d";
export type MetricMode = "authored" | "merged";
export type AnalyticsView = "daily" | "weekly" | "monthly";

type PipelineStep = {
  title: string;
  body: string;
  icon: LucideIcon;
};

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getSampleSeries(view: AnalyticsView, mode: MetricMode) {
  if (view === "daily") {
    return mode === "authored"
      ? {
          labels: ["Mar 1", "Mar 2", "Mar 3", "Mar 4", "Mar 5", "Mar 6", "Mar 7", "Mar 8", "Mar 9", "Mar 10", "Mar 11", "Mar 12", "Mar 13", "Mar 14"],
          additions: [42, 58, 76, 24, 110, 92, 64, 38, 84, 126, 98, 72, 61, 117],
          deletions: [16, 22, 30, 10, 48, 36, 28, 14, 32, 56, 44, 31, 24, 53],
          chartTitle: "Daily activity",
          filter: "Last 14 days",
        }
      : {
          labels: ["Mar 1", "Mar 2", "Mar 3", "Mar 4", "Mar 5", "Mar 6", "Mar 7", "Mar 8", "Mar 9", "Mar 10", "Mar 11", "Mar 12", "Mar 13", "Mar 14"],
          additions: [18, 24, 34, 12, 52, 60, 28, 22, 40, 74, 66, 48, 39, 68],
          deletions: [7, 9, 12, 5, 18, 21, 11, 8, 14, 29, 24, 17, 13, 25],
          chartTitle: "Daily shipped activity",
          filter: "Last 14 days",
        };
  }

  if (view === "monthly") {
    return mode === "authored"
      ? {
          labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
          additions: [1240, 1560, 980, 1820, 1490, 1710, 2100, 1940, 1680, 2210, 2460, 2080],
          deletions: [410, 520, 360, 640, 510, 570, 730, 690, 580, 760, 820, 740],
          chartTitle: "Monthly activity",
          filter: "Last 12 months",
        }
      : {
          labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"],
          additions: [760, 980, 620, 1120, 940, 1080, 1310, 1260, 1010, 1430, 1580, 1390],
          deletions: [240, 310, 190, 410, 320, 360, 470, 430, 350, 520, 560, 505],
          chartTitle: "Monthly shipped activity",
          filter: "Last 12 months",
        };
  }

  return mode === "authored"
    ? {
        labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"],
        additions: [180, 260, 340, 720, 460, 980, 630, 1180, 740, 910, 860, 1290],
        deletions: [92, 124, 180, 240, 210, 440, 360, 520, 330, 410, 390, 560],
        chartTitle: "Weekly activity",
        filter: "Last 12 weeks",
      }
    : {
        labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"],
        additions: [110, 150, 210, 410, 280, 560, 360, 640, 420, 510, 490, 710],
        deletions: [50, 72, 96, 138, 120, 220, 176, 264, 184, 210, 204, 288],
        chartTitle: "Weekly shipped activity",
        filter: "Last 12 weeks",
      };
}

export function getDashboardData(
  view: AnalyticsView = "weekly",
  mode: MetricMode = "authored",
) {
  const series = getSampleSeries(view, mode);
  const maxValue = Math.max(...series.additions, ...series.deletions);
  const totalAdditions = series.additions.reduce((sum, value) => sum + value, 0);
  const totalDeletions = series.deletions.reduce((sum, value) => sum + value, 0);
  const shippedRatio =
    mode === "merged"
      ? "100%"
      : `${Math.round((totalAdditions * 0.72) / Math.max(totalAdditions, 1) * 100)}%`;

  return {
    profile: {
      login: "@rudraksh",
      source: "sample" as const,
    },
    filters: [
      series.filter,
      mode === "authored" ? "Authored commits" : "Merged to default branch",
      "Deduped by SHA",
      "All installed repos",
    ],
    summary: [
      {
        label: "Lines added",
        value: `+${formatNumber(totalAdditions)}`,
        detail:
          mode === "authored"
            ? "From sample authored commits across installed repositories."
            : "From sample commits that landed on the default branch.",
      },
      {
        label: "Lines deleted",
        value: `-${formatNumber(totalDeletions)}`,
        detail: "Recorded once even if the commit appears on multiple branches.",
      },
      {
        label: "Merged to default branch",
        value: shippedRatio,
        detail:
          mode === "authored"
            ? "Estimated share of authored work that shipped."
            : "The shipped-code lens is active right now.",
      },
      {
        label: "Open sync lag",
        value: "4m",
        detail: "Hybrid sync keeps the dashboard fast while backfilling history.",
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
        detail:
          mode === "authored"
            ? "Largest source of authored changes in the selected sample window."
            : "Most shipped work landed here in the selected sample window.",
        visibility: "private",
        additions: mode === "authored" ? 1_840 : 1_120,
        deletions: mode === "authored" ? 780 : 430,
        commitCount: mode === "authored" ? 17 : 11,
      },
      {
        name: "vibe-tracker/worker",
        detail:
          mode === "authored"
            ? "Sync orchestration and dedupe logic."
            : "Background jobs and shipped sync orchestration.",
        visibility: "private",
        additions: mode === "authored" ? 1_120 : 830,
        deletions: mode === "authored" ? 490 : 320,
        commitCount: mode === "authored" ? 11 : 8,
      },
      {
        name: "shared/github-client",
        detail:
          mode === "authored"
            ? "GitHub installation auth and API wrappers."
            : "Shared API wrapper updates that reached default branch.",
        visibility: "internal",
        additions: mode === "authored" ? 790 : 560,
        deletions: mode === "authored" ? 420 : 240,
        commitCount: mode === "authored" ? 9 : 6,
      },
    ],
    decisions: [
      {
        title: "Product shape",
        value: "Web app with a backend API and background sync.",
      },
      {
        title: "User scope",
        value: "Logged-in users see repositories they authorize through GitHub.",
      },
      {
        title: "Metric definition",
        value: "Primary metric is authored commit volume, with a merged-to-default toggle.",
      },
      {
        title: "Deduplication",
        value: "Commits are deduped by SHA to avoid branch and PR double counting.",
      },
      {
        title: "Time lens",
        value: "Author date is the default lens for day, week, month, and custom windows.",
      },
      {
        title: "Sync strategy",
        value: "Hybrid live fetch plus background caching in a local database.",
      },
    ],
    pipeline: [
      {
        title: "Discover repositories",
        body: "Read the installations granted to the app and enqueue repo syncs by installation scope.",
        icon: ShieldCheck,
      },
      {
        title: "Index branches and commits",
        body: "Walk refs, fetch commits within the requested window, and persist commit stats plus branch membership.",
        icon: GitBranch,
      },
      {
        title: "Link pull requests",
        body: "Attach PR metadata for drilldowns while keeping commits as the canonical metric source.",
        icon: GitPullRequest,
      },
      {
        title: "Refresh incrementally",
        body: "Use recent windows for live fetches and hand off deep history to repeatable background jobs.",
        icon: RefreshCcw,
      },
      {
        title: "Serve windowed analytics",
        body: "Aggregate by user, repo, and time bucket from normalized commit records.",
        icon: Clock3,
      },
    ] satisfies PipelineStep[],
  };
}
