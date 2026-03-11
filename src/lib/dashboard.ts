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

type PipelineStep = {
  title: string;
  body: string;
  icon: LucideIcon;
};

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function getDashboardData() {
  const additions = [340, 720, 460, 980, 630, 1180];
  const deletions = [180, 240, 210, 440, 360, 520];
  const maxValue = Math.max(...additions, ...deletions);

  return {
    profile: {
      login: "@rudraksh",
    },
    filters: ["30 days", "Authored commits", "Deduped by SHA", "All installed repos"],
    summary: [
      {
        label: "Lines added",
        value: `+${formatNumber(4_310)}`,
        detail: "From 42 unique commits across 7 repositories.",
      },
      {
        label: "Lines deleted",
        value: `-${formatNumber(1_950)}`,
        detail: "Recorded once even if the commit appears on multiple branches.",
      },
      {
        label: "Merged to default branch",
        value: "76%",
        detail: "Toggleable lens for shipped code versus authored work.",
      },
      {
        label: "Open sync lag",
        value: "4m",
        detail: "Hybrid sync keeps the dashboard fast while backfilling history.",
      },
    ],
    timeline: additions.map((value, index) => ({
      label: `W${index + 1}`,
      additions: value,
      deletions: deletions[index],
      additionsHeight: Math.round((value / maxValue) * 100),
      deletionsHeight: Math.round((deletions[index] / maxValue) * 100),
    })),
    repositories: [
      {
        name: "vibe-tracker/web",
        detail: "Default branch landed most of the last two weeks of work.",
        visibility: "private",
        additions: 1_840,
        deletions: 780,
        commitCount: 17,
      },
      {
        name: "vibe-tracker/worker",
        detail: "Sync orchestration and dedupe logic.",
        visibility: "private",
        additions: 1_120,
        deletions: 490,
        commitCount: 11,
      },
      {
        name: "shared/github-client",
        detail: "GitHub installation auth and API wrappers.",
        visibility: "internal",
        additions: 790,
        deletions: 420,
        commitCount: 9,
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
