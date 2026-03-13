import Link from "next/link";
import { ArrowRight, CheckCircle2, Github, LineChart, RefreshCcw, TimerReset } from "lucide-react";

import { ActivitySyncRefresh } from "@/components/activity-sync-refresh";
import { formatNumber } from "@/lib/dashboard";
import type { AnalyticsView, MetricMode } from "@/lib/dashboard";
import { getGithubConnectionState } from "@/lib/github-state";
import { getLiveMetrics } from "@/lib/live-metrics";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const GITHUB_STATUS_COPY: Record<string, { label: string; detail?: string }> = {
  "activity-sync-started": {
    label: "Activity sync started",
    detail:
      "The dashboard will refresh automatically while your activity is being pulled in.",
  },
  "activity-sync-running": {
    label: "Activity sync is already running",
    detail:
      "A sync is already in progress. The dashboard will refresh automatically; no extra clicks are needed.",
  },
  connected: {
    label: "GitHub connected",
  },
  "installation-connected": {
    label: "Installation connected",
    detail:
      "Your repository access is available now. Run an activity sync to load your coding totals.",
  },
  "invalid-installation": {
    label: "Installation could not be resolved",
  },
  "invalid-state": {
    label: "OAuth state mismatch",
    detail:
      "GitHub returned to the app without a valid auth state. Start the connection flow again in the same tab.",
  },
  "missing-code": {
    label: "GitHub did not return an auth code",
  },
  "missing-config": {
    label: "GitHub integration is not configured",
  },
  "not-connected": {
    label: "GitHub account is not connected",
  },
  "oauth-account-failed": {
    label: "GitHub connected, but account setup failed",
    detail:
      "GitHub connected, but the app could not finish setting up your account. Please try again.",
  },
  "oauth-installations-failed": {
    label: "GitHub connected, but installations could not be loaded",
    detail:
      "The GitHub login worked, but installation access could not be read yet.",
  },
  "oauth-session-failed": {
    label: "GitHub connected, but the session could not be stored",
    detail:
      "GitHub connected, but the app could not complete sign-in. Please try again.",
  },
  "oauth-token-failed": {
    label: "GitHub token exchange failed",
    detail: "GitHub sign-in did not complete successfully. Please try again.",
  },
  "oauth-user-failed": {
    label: "GitHub token worked, but user lookup failed",
    detail: "GitHub authenticated the app, but user profile lookup failed.",
  },
  "repositories-refreshed": {
    label: "Repositories refreshed",
  },
  "sync-failed": {
    label: "Sync failed",
    detail: "The app could not complete your activity sync. Please try again.",
  },
};

const CONNECT_STEPS = [
  {
    title: "Connect your GitHub account",
    detail: "Start the OAuth flow and store the local session used for metrics and sync jobs.",
  },
  {
    title: "Install the GitHub App",
    detail: "Grant access to the user or organization whose repositories should count toward the dashboard.",
  },
  {
    title: "Run activity sync",
    detail: "Pull commit metadata into the local database so the dashboard can calculate real totals.",
  },
];

function getStatusTone(status?: string) {
  if (!status) {
    return "status-note status-note-neutral";
  }

  if (
    status.includes("failed") ||
    status.includes("invalid") ||
    status.includes("missing")
  ) {
    return "status-note status-note-danger";
  }

  if (status.includes("running") || status.includes("started")) {
    return "status-note status-note-active";
  }

  return "status-note status-note-success";
}

function ConnectionAction({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link href={href} className="button-primary w-full sm:w-auto">
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

type TimelinePoint = {
  label: string;
  additions: number;
  deletions: number;
};

const CHART_WIDTH = 960;
const CHART_HEIGHT = 320;
const CHART_PADDING = { top: 18, right: 18, bottom: 34, left: 58 };

function roundTick(value: number) {
  if (value <= 0) {
    return 0;
  }

  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.ceil(value / magnitude) * magnitude;
}

function getTickValues(maxValue: number) {
  const roundedMax = roundTick(maxValue);
  return [roundedMax, Math.round(roundedMax * 0.66), Math.round(roundedMax * 0.33), 0];
}

function buildChartGeometry(timeline: TimelinePoint[]) {
  const innerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const maxValue = Math.max(
    1,
    ...timeline.flatMap((point) => [point.additions, point.deletions]),
  );

  const toY = (value: number) => {
    if (value <= 0) {
      return CHART_PADDING.top + innerHeight;
    }

    const normalized = Math.sqrt(value / maxValue);
    return CHART_PADDING.top + innerHeight - normalized * innerHeight;
  };

  const getX = (index: number) =>
    CHART_PADDING.left +
    (timeline.length === 1 ? innerWidth / 2 : (index / (timeline.length - 1)) * innerWidth);

  const additionsPoints = timeline.map((point, index) => ({
    x: getX(index),
    y: toY(point.additions),
    value: point.additions,
    label: point.label,
  }));
  const deletionsPoints = timeline.map((point, index) => ({
    x: getX(index),
    y: toY(point.deletions),
    value: point.deletions,
    label: point.label,
  }));

  const linePath = (points: { x: number; y: number }[]) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  const areaPath = (points: { x: number; y: number }[]) => {
    const baseline = CHART_PADDING.top + innerHeight;
    const line = linePath(points);
    const lastPoint = points.at(-1);
    const firstPoint = points[0];

    if (!lastPoint || !firstPoint) {
      return "";
    }

    return `${line} L ${lastPoint.x} ${baseline} L ${firstPoint.x} ${baseline} Z`;
  };

  return {
    ticks: getTickValues(maxValue),
    maxValue,
    maxAdditions: Math.max(...timeline.map((point) => point.additions), 0),
    maxDeletions: Math.max(...timeline.map((point) => point.deletions), 0),
    additionsPoints,
    deletionsPoints,
    additionsLine: linePath(additionsPoints),
    deletionsLine: linePath(deletionsPoints),
    additionsArea: areaPath(additionsPoints),
    deletionsArea: areaPath(deletionsPoints),
    baselineY: CHART_PADDING.top + innerHeight,
    innerHeight,
    innerWidth,
    toY,
  };
}

function shouldShowXAxisLabel(index: number, total: number, view: AnalyticsView) {
  if (index === 0 || index === total - 1) {
    return true;
  }

  if (view === "monthly") {
    return true;
  }

  return index % 2 === 0;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  const view =
    typeof params.view === "string" &&
    ["daily", "weekly", "monthly"].includes(params.view)
      ? (params.view as AnalyticsView)
      : "weekly";
  const mode =
    typeof params.mode === "string" &&
    ["authored", "merged"].includes(params.mode)
      ? (params.mode as MetricMode)
      : "authored";
  const githubState = await getGithubConnectionState();
  const dashboard = githubState.connected
    ? await getLiveMetrics(view, mode)
    : null;
  const githubStatus =
    typeof params.github === "string" ? params.github : undefined;
  const githubStatusCopy = githubStatus
    ? GITHUB_STATUS_COPY[githubStatus] ?? { label: githubStatus }
    : null;
  const views: AnalyticsView[] = ["daily", "weekly", "monthly"];
  const modes: MetricMode[] = ["authored", "merged"];
  const hasInstallations = githubState.installations.length > 0;
  const syncRefreshActive = Boolean(
    githubStatus === "activity-sync-started" ||
      githubStatus === "activity-sync-running" ||
      githubState.activitySyncRunning ||
      dashboard?.activitySyncRunning,
  );
  const repoActivityMax = Math.max(
    1,
    ...(dashboard?.repositories.map(
      (repository) => repository.additions + repository.deletions,
    ) ?? [1]),
  );
  const chartGeometry = dashboard ? buildChartGeometry(dashboard.timeline) : null;

  return (
    <main className="aurora-shell min-h-screen">
      <ActivitySyncRefresh active={syncRefreshActive} />
      <div className="page-grid" />
      <div className="page-noise" />

      <div className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
        <section className="hero-panel">
          <div className="flex w-full flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">
                  <span className="rounded-full border border-white/12 px-3 py-1">
                    Vibe Tracker
                  </span>
                  <span className="rounded-full border border-white/12 px-3 py-1">
                    Core dashboard
                  </span>
                  <span className="rounded-full border border-white/12 px-3 py-1">
                    {githubState.connected ? "GitHub connected" : "Not connected"}
                  </span>
                </div>
                <div className="space-y-2">
                  <h1 className="max-w-3xl text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">
                    Read the signal, not the chrome.
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted sm:text-base">
                    Identity, key output, trend, repositories, and sync health.
                    The rest is gone.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                {githubState.primaryAction ? (
                  <ConnectionAction
                    href={githubState.primaryAction.href}
                    label={githubState.primaryAction.label}
                  />
                ) : null}
                {dashboard ? (
                  <Link
                    href={`/api/metrics?view=${view}&mode=${mode}`}
                    className="button-secondary w-full sm:w-auto"
                  >
                    Metrics JSON
                    <LineChart className="h-4 w-4" />
                  </Link>
                ) : null}
                {githubState.connected ? (
                  <form action="/api/github/activity-sync" method="post">
                    <button
                      type="submit"
                      className="button-secondary w-full sm:w-auto"
                      disabled={githubState.activitySyncRunning}
                    >
                      {githubState.activitySyncRunning ? "Syncing" : "Sync now"}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
              <section className="story-panel !p-4">
                <p className="panel-label">Identity</p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold tracking-[-0.05em] text-foreground">
                      {dashboard?.profile.login ?? githubState.viewer?.login ?? "Connect GitHub"}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {dashboard
                        ? "Live GitHub metrics in the current view."
                        : githubState.description}
                    </p>
                  </div>
                  {githubState.connected ? (
                    <CheckCircle2 className="mt-1 h-5 w-5 text-lime-300" />
                  ) : (
                    <Github className="mt-1 h-5 w-5 text-muted" />
                  )}
                </div>
              </section>

              <section className="story-panel !p-4">
                <p className="panel-label">Connection</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{githubState.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {githubState.viewer
                    ? `Session ${githubState.viewer.sessionExpiryLabel}`
                    : "Sign in to unlock live metrics."}
                </p>
              </section>

              <section className="story-panel !p-4">
                <p className="panel-label">Sync</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {githubState.activitySyncRunning
                    ? "Running"
                    : githubState.activitySync
                      ? githubState.activitySync.status
                      : "Idle"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {githubState.activitySync
                    ? githubState.activitySync.updatedAt
                    : "No sync completed yet."}
                </p>
              </section>

              <section className="story-panel !p-4">
                <p className="panel-label">Installations</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {githubState.installations.length} scope
                  {githubState.installations.length === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {hasInstallations ? "Repository access cached locally." : "No scopes installed yet."}
                </p>
              </section>
            </div>
          </div>
        </section>

        {githubStatus ? (
          <section className={getStatusTone(githubStatus)}>
            <div className="flex items-start gap-3">
              <TimerReset className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {githubStatusCopy?.label ?? githubStatus}
                </p>
                {githubStatusCopy?.detail ? (
                  <p className="mt-1 max-w-4xl text-sm leading-6 text-muted">
                    {githubStatusCopy.detail}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {dashboard ? (
          <>
            <section id="dashboard" className="dashboard-shell">
              <div className="dashboard-head">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="eyebrow eyebrow-subtle">
                      {dashboard.profile.source === "live"
                        ? "Live dashboard"
                        : "Sample dashboard"}
                    </span>
                    <span className="dashboard-pill">{dashboard.chartTitle}</span>
                  </div>
                  <div className="space-y-3">
                    <h2 className="dashboard-title">{dashboard.profile.login}</h2>
                    <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                      {dashboard.profile.source === "live"
                        ? "These metrics are aggregated from synced GitHub commits in the local database."
                        : "Local demo data that mirrors the model we will populate from the GitHub API during sync jobs."}
                    </p>
                  </div>
                </div>

                <div className="control-stack">
                  <div className="control-group">
                    {views.map((entry) => (
                      <Link
                        key={entry}
                        href={`/?view=${entry}&mode=${mode}`}
                        className={
                          entry === view
                            ? "toggle-pill toggle-pill-active"
                            : "toggle-pill"
                        }
                      >
                        {entry[0]?.toUpperCase()}
                        {entry.slice(1)}
                      </Link>
                    ))}
                  </div>

                  <div className="control-group">
                    {modes.map((entry) => (
                      <Link
                        key={entry}
                        href={`/?view=${view}&mode=${entry}`}
                        className={
                          entry === mode
                            ? "toggle-pill toggle-pill-active"
                            : "toggle-pill"
                        }
                      >
                        {entry === "authored" ? "Authored" : "Merged"}
                      </Link>
                    ))}
                  </div>

                  <div className="filter-row">
                    {dashboard.filters.map((filter) => (
                      <span key={filter} className="filter-chip">
                        {filter}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {dashboard.summary.map((item, index) => (
                  <article
                    key={item.label}
                    className={index === 0 ? "metric-card metric-card-featured" : "metric-card"}
                  >
                    <p className="metric-label">{item.label}</p>
                    <p className="metric-value">{item.value}</p>
                    <p className="metric-detail">{item.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="story-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="panel-label text-accent">{dashboard.chartTitle}</p>
                  <h3 className="panel-heading">Activity trend</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    <span className="h-2 w-2 rounded-full bg-cyan-300" />
                    Additions
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    <span className="h-2 w-2 rounded-full bg-lime-300" />
                    Deletions
                  </span>
                  <span className="dashboard-pill">Author date lens</span>
                </div>
              </div>

              {chartGeometry ? (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <article className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                        Peak additions
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        +{formatNumber(chartGeometry.maxAdditions)}
                      </p>
                    </article>
                    <article className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                        Highest deletion month
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        -{formatNumber(chartGeometry.maxDeletions)}
                      </p>
                    </article>
                    <article className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                        Scaling
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        Sqrt-scaled to keep smaller months visible instead of flattening them.
                      </p>
                    </article>
                  </div>

                  <div className="overflow-hidden rounded-[1.5rem] border border-white/8 bg-black/20 p-3 sm:p-5">
                    <svg
                      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                      className="h-[22rem] w-full"
                      role="img"
                      aria-label={`${dashboard.chartTitle} additions and deletions trend`}
                    >
                      {chartGeometry.ticks.map((tick) => {
                        const y = chartGeometry.toY(tick);

                        return (
                          <g key={tick}>
                            <line
                              x1={CHART_PADDING.left}
                              x2={CHART_WIDTH - CHART_PADDING.right}
                              y1={y}
                              y2={y}
                              stroke="rgba(255,255,255,0.08)"
                              strokeDasharray="4 10"
                            />
                            <text
                              x={CHART_PADDING.left - 12}
                              y={y + 4}
                              textAnchor="end"
                              fill="rgba(255,255,255,0.58)"
                              fontSize="12"
                            >
                              {tick === 0 ? "0" : formatNumber(tick)}
                            </text>
                          </g>
                        );
                      })}

                      <path d={chartGeometry.deletionsArea} fill="rgba(163, 230, 53, 0.08)" />
                      <path d={chartGeometry.additionsArea} fill="rgba(103, 232, 249, 0.08)" />
                      <path
                        d={chartGeometry.deletionsLine}
                        fill="none"
                        stroke="rgba(163, 230, 53, 0.95)"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      <path
                        d={chartGeometry.additionsLine}
                        fill="none"
                        stroke="rgba(103, 232, 249, 0.95)"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />

                      {chartGeometry.additionsPoints.map((point, index) => (
                        <g key={point.label}>
                          <circle cx={point.x} cy={point.y} r="4" fill="rgba(103, 232, 249, 1)" />
                          <circle
                            cx={chartGeometry.deletionsPoints[index]?.x}
                            cy={chartGeometry.deletionsPoints[index]?.y}
                            r="4"
                            fill="rgba(163, 230, 53, 1)"
                          />
                          {shouldShowXAxisLabel(index, dashboard.timeline.length, view) ? (
                            <text
                              x={point.x}
                              y={CHART_HEIGHT - 8}
                              textAnchor="middle"
                              fill="rgba(255,255,255,0.65)"
                              fontSize="12"
                            >
                              {point.label}
                            </text>
                          ) : null}
                        </g>
                      ))}
                    </svg>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {dashboard.timeline.map((point, index) =>
                        shouldShowXAxisLabel(index, dashboard.timeline.length, view) ? (
                          <article
                            key={point.label}
                            className="rounded-[1rem] border border-white/6 bg-white/[0.03] px-3 py-2"
                          >
                            <p className="text-xs text-muted">{point.label}</p>
                            <p className="mt-1 font-mono text-sm text-foreground/85">
                              +{formatNumber(point.additions)} / -{formatNumber(point.deletions)}
                            </p>
                          </article>
                        ) : null,
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-[1.25rem] border border-white/8 bg-black/20 px-4 py-6 text-sm text-muted">
                  No timeline data available yet.
                </div>
              )}
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px]">
              <section className="story-panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="panel-label">Repository pressure</p>
                    <h3 className="panel-heading">Where the work landed</h3>
                  </div>
                  <span className="dashboard-pill">
                    {dashboard.repositories.length} repos
                  </span>
                </div>

                <div className="repo-list">
                  {dashboard.repositories.length > 0 ? (
                    dashboard.repositories.map((repo, index) => {
                      const totalActivity = repo.additions + repo.deletions;
                      const width = `${Math.max(
                        12,
                        (totalActivity / repoActivityMax) * 100,
                      )}%`;

                      return (
                        <article key={repo.name} className="repo-card">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <span className="repo-rank">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                <h3 className="font-semibold text-foreground">
                                  {repo.name}
                                </h3>
                              </div>
                              <p className="text-sm leading-6 text-muted">
                                {repo.detail}
                              </p>
                            </div>
                            <span className="repo-visibility">{repo.visibility}</span>
                          </div>

                          <div className="mt-4 space-y-3">
                            <div className="repo-meter">
                              <div className="repo-meter-fill" style={{ width }} />
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                              <span>+{formatNumber(repo.additions)}</span>
                              <span>-{formatNumber(repo.deletions)}</span>
                              <span>{repo.commitCount} commits</span>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <article className="repo-card">
                      <h3 className="font-semibold text-foreground">
                        No synced repositories yet
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        Install the GitHub App on a user or organization,
                        refresh repositories, then run your first activity sync.
                      </p>
                    </article>
                  )}
                </div>
              </section>

              <aside className="flex flex-col gap-4">
                <section className="story-panel !p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="panel-label">Account</p>
                      <h3 className="panel-heading !text-[1.35rem]">
                        {githubState.viewer?.login ?? "Not signed in"}
                      </h3>
                    </div>
                    {githubState.connected ? (
                      <CheckCircle2 className="h-5 w-5 text-lime-300" />
                    ) : (
                      <Github className="h-5 w-5 text-muted" />
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {githubState.activitySync
                      ? `Latest sync: ${githubState.activitySync.status} at ${githubState.activitySync.updatedAt}`
                      : "No completed sync recorded yet."}
                  </p>
                </section>

                <section className="story-panel !p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="panel-label">Installations</p>
                      <h3 className="panel-heading !text-[1.35rem]">
                        {githubState.installations.length} connected scope
                        {githubState.installations.length === 1 ? "" : "s"}
                      </h3>
                    </div>
                    <RefreshCcw className="h-4 w-4 text-muted" />
                  </div>

                  <div className="mt-4 space-y-3">
                    {hasInstallations ? (
                      githubState.installations.map((installation) => (
                        <article key={installation.id} className="installation-card">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-lg font-semibold text-foreground">
                                {installation.accountLogin}
                              </h3>
                              <p className="mt-1 text-sm text-muted">
                                {installation.repositoryCount} repos indexed locally
                              </p>
                            </div>
                            <span className="dashboard-pill">#{installation.githubInstallId}</span>
                          </div>
                          <p className="mt-3 break-words text-sm leading-6 text-muted">
                            {installation.repositoryNames.length > 0
                              ? installation.repositoryNames.join(", ")
                              : "No repositories cached yet. Refresh repositories to pull grants."}
                          </p>
                          <form
                            action={`/api/github/installations/${installation.githubInstallId}/sync`}
                            method="post"
                            className="mt-4"
                          >
                            <button type="submit" className="button-secondary w-full">
                              Refresh repositories
                            </button>
                          </form>
                        </article>
                      ))
                    ) : (
                      <article className="installation-card">
                        <h3 className="text-lg font-semibold text-foreground">
                          Nothing installed yet
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          Install the GitHub App on the account you want to measure to
                          unlock repository-level metrics.
                        </p>
                      </article>
                    )}
                  </div>
                </section>
              </aside>
            </section>
          </>
        ) : (
          <section id="dashboard" className="dashboard-shell">
            <div className="flex h-full flex-col gap-8">
              <div className="space-y-4">
                <span className="eyebrow eyebrow-subtle">Not connected</span>
                <h2 className="dashboard-title max-w-3xl">
                  Connect GitHub before expecting any dashboard signal.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                  This product does not simulate activity for you. Until GitHub
                  is connected and synced, there is nothing real to measure.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {CONNECT_STEPS.map((step, index) => (
                  <article key={step.title} className="onboarding-card">
                    <p className="panel-label">Step {index + 1}</p>
                    <h3 className="mt-3 text-xl font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {step.detail}
                    </p>
                  </article>
                ))}
              </div>

              <section className="story-panel max-w-3xl">
                <p className="panel-label">Current state</p>
                <h3 className="panel-heading">{githubState.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {githubState.description}
                </p>
                {githubState.primaryAction ? (
                  <div className="mt-5">
                    <ConnectionAction
                      href={githubState.primaryAction.href}
                      label={githubState.primaryAction.label}
                    />
                  </div>
                ) : null}
              </section>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
