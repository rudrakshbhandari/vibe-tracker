import Link from "next/link";
import { ArrowRight, CheckCircle2, Github, RefreshCcw, ShieldCheck, TimerReset } from "lucide-react";

import { ActivityBarChart } from "@/components/activity-bar-chart";
import { ActivitySyncRefresh } from "@/components/activity-sync-refresh";
import { ThemeToggle } from "@/components/theme-toggle";
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
  "activity-sync-completed": {
    label: "Activity sync completed",
    detail:
      "Shipped-work totals were refreshed. If the dashboard still looks empty, the selected scope may not contain merged PRs in the current time window.",
  },
  connected: {
    label: "GitHub connected",
  },
  "installation-connected": {
    label: "Installation connected",
    detail:
      "Repository access is available now. Run a shipped-work sync to load your coding totals.",
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
      "GitHub connected, but the app could not finish storing your account data. If this keeps happening, reset the session and try again.",
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
  "session-reset": {
    label: "Session reset",
    detail: "The saved session was cleared. Connect GitHub again to start fresh.",
  },
  "sync-failed": {
    label: "Sync failed",
    detail: "The app could not complete your activity sync. Please try again.",
  },
};

const CONNECT_STEPS = [
  {
    title: "Connect your GitHub account",
    detail: "Sign in once so the dashboard knows which merged pull requests belong to you.",
  },
  {
    title: "Grant repository access",
    detail: "Install the GitHub App on the user or organization you want included.",
  },
  {
    title: "Run the first sync",
    detail: "Pull merged PR counts and line stats into the local database so the totals become real.",
  },
];

const TRUST_ITEMS = [
  {
    title: "Reads metric inputs, not repo files",
    detail:
      "The current sync reads repository scope plus merged pull request stats needed for shipped-work analytics.",
  },
  {
    title: "Stores less than before",
    detail:
      "GitHub session tokens are stored encrypted, and the dashboard no longer needs PR titles or branch names in the database.",
  },
  {
    title: "Makes the permission model explicit",
    detail:
      "Users can inspect the privacy page before connecting GitHub instead of guessing what the app can access.",
  },
];

type TimelinePoint = {
  label: string;
  additions: number;
  deletions: number;
};

const CHART_WIDTH = 960;
const CHART_HEIGHT = 360;
const CHART_PADDING = { top: 20, right: 16, bottom: 40, left: 62 };

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
  tone = "primary",
}: {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={tone === "primary" ? "button-primary w-full sm:w-auto" : "button-secondary w-full sm:w-auto"}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

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

function buildBarChartGeometry(timeline: TimelinePoint[]) {
  const innerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const maxValue = Math.max(
    1,
    ...timeline.flatMap((point) => [point.additions, point.deletions]),
  );
  const groupWidth = innerWidth / Math.max(timeline.length, 1);
  const barWidth = Math.min(22, Math.max(10, groupWidth * 0.28));
  const barGap = Math.max(4, groupWidth * 0.08);
  const baselineY = CHART_PADDING.top + innerHeight;

  const toHeight = (value: number) => {
    if (value <= 0) {
      return 0;
    }

    return Math.max(6, (value / maxValue) * innerHeight);
  };

  const bars = timeline.map((point, index) => {
    const centerX = CHART_PADDING.left + index * groupWidth + groupWidth / 2;
    const additionsHeight = toHeight(point.additions);
    const deletionsHeight = toHeight(point.deletions);

    return {
      label: point.label,
      centerX,
      additionsValue: point.additions,
      deletionsValue: point.deletions,
      additions: {
        x: centerX - barWidth - barGap / 2,
        y: baselineY - additionsHeight,
        height: additionsHeight,
      },
      deletions: {
        x: centerX + barGap / 2,
        y: baselineY - deletionsHeight,
        height: deletionsHeight,
      },
    };
  });

  return {
    ticks: getTickValues(maxValue),
    maxAdditions: Math.max(...timeline.map((point) => point.additions), 0),
    maxDeletions: Math.max(...timeline.map((point) => point.deletions), 0),
    bars,
    baselineY,
    barWidth,
    maxValue,
    innerHeight,
  };
}

function DashboardMetrics({
  summary,
}: {
  summary: Array<{ label: string; value: string; detail: string }>;
}) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {summary.map((item) => (
        <article key={item.label} className="metric-card">
          <p className="metric-label">{item.label}</p>
          <p className="metric-value">{item.value}</p>
          <p className="metric-detail">{item.detail}</p>
        </article>
      ))}
    </div>
  );
}

type GithubStateInstallation = {
  id: string;
  githubInstallId: number;
  accountLogin: string;
  repositoryCount: number;
  repositoryNames: string[];
};

type RepoSummary = {
  name: string;
  detail: string;
  visibility: string;
  additions: number;
  deletions: number;
  commitCount: number;
};

function RepoSection({
  repositories,
  repoActivityMax,
  installations,
  connected,
  hasInstallations,
  accessibleRepositoryCount,
}: {
  repositories: RepoSummary[];
  repoActivityMax: number;
  installations: GithubStateInstallation[];
  connected: boolean;
  hasInstallations: boolean;
  accessibleRepositoryCount: number;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px]">
      <section className="story-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="panel-label">Repository pressure</p>
            <h3 className="panel-heading">Where the work landed</h3>
          </div>
          <span className="dashboard-pill">{repositories.length} repos</span>
        </div>

        <div className="repo-list">
          {repositories.length > 0 ? (
            repositories.map((repo, index) => {
              const totalActivity = repo.additions + repo.deletions;
              const width = `${Math.max(12, (totalActivity / repoActivityMax) * 100)}%`;
              return (
                <article key={repo.name} className="repo-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="repo-rank">{String(index + 1).padStart(2, "0")}</span>
                        <h3 className="text-lg font-semibold text-foreground">{repo.name}</h3>
                      </div>
                      <p className="text-sm leading-6 text-muted">{repo.detail}</p>
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
              <h3 className="text-lg font-semibold text-foreground">No synced repositories yet</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Install the GitHub App, then run the first sync to populate repository metrics.
              </p>
            </article>
          )}
        </div>
      </section>

      <aside className="sidebar-panel">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="panel-label">Connected scope</p>
            <h3 className="panel-heading">
              {hasInstallations
                ? `${installations.length} GitHub App installation${installations.length === 1 ? "" : "s"}`
                : "No installation yet"}
            </h3>
          </div>
          {connected ? (
            <CheckCircle2 className="mt-1 h-5 w-5 text-[var(--success)]" />
          ) : (
            <Github className="mt-1 h-5 w-5 text-muted" />
          )}
        </div>

        <p className="scope-summary">
          {hasInstallations
            ? `${formatNumber(accessibleRepositoryCount)} repositories are available in the current scope.`
            : "Install the GitHub App on the account you want to measure to unlock repository-level metrics."}
        </p>

        {hasInstallations ? (
          <div className="scope-list">
            {installations.map((installation, index) => (
              <article key={installation.id} className="scope-item">
                <div className="scope-item-head">
                  <div>
                    <p className="scope-item-title">
                      {installations.length === 1 ? "Primary scope" : installation.accountLogin}
                    </p>
                    <p className="scope-item-meta">{installation.repositoryCount} cached repos</p>
                  </div>
                  <form
                    action={`/api/github/installations/${installation.githubInstallId}/sync`}
                    method="post"
                  >
                    <button type="submit" className="button-secondary button-compact">
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                  </form>
                </div>
                <p className="scope-copy">
                  {installation.repositoryNames.length > 0
                    ? installation.repositoryNames.join(", ")
                    : index === 0
                      ? "Repository names will appear here after the next refresh."
                      : "No repositories cached yet for this scope."}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <ConnectionAction href="/api/github/install" label="Install GitHub App" />
          </div>
        )}
      </aside>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="story-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="panel-label">Launch trust</p>
          <h3 className="panel-heading">What the app reads and what it does not</h3>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
            Users are right to be skeptical. The product needs a plain-English data story before
            asking for GitHub access.
          </p>
        </div>

        <Link href="/privacy" className="button-secondary w-full sm:w-auto">
          Read privacy breakdown
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {TRUST_ITEMS.map((item) => (
          <article key={item.title} className="onboarding-card">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-[var(--success)]" />
              <div>
                <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{item.detail}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const FALLBACK_GITHUB_STATE = {
  connected: false,
  title: "Something went wrong",
  description: "We could not load your connection state. Please try again.",
  primaryAction: { label: "Reconnect GitHub", href: "/api/github/connect" },
  viewer: null,
  activitySync: null,
  activitySyncRunning: false,
  installations: [] as Array<{
    id: string;
    githubInstallId: number;
    accountLogin: string;
    repositoryCount: number;
    repositoryNames: string[];
  }>,
};

export default async function Home({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  const view =
    typeof params.view === "string" &&
    ["daily", "weekly", "monthly"].includes(params.view)
      ? (params.view as AnalyticsView)
      : "daily";
  const mode: MetricMode = "shipped";
  const githubStatus = typeof params.github === "string" ? params.github : undefined;

  let githubState;
  let dashboard: Awaited<ReturnType<typeof getLiveMetrics>> = null;
  try {
    githubState = await getGithubConnectionState();
    dashboard = githubState.connected ? await getLiveMetrics(view, mode) : null;
  } catch {
    githubState = FALLBACK_GITHUB_STATE;
    dashboard = null;
  }
  const githubStatusCopy = githubStatus
    ? GITHUB_STATUS_COPY[githubStatus] ?? { label: githubStatus }
    : null;
  const views: AnalyticsView[] = ["daily", "weekly", "monthly"];
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
  const chartGeometry = dashboard ? buildBarChartGeometry(dashboard.timeline) : null;
  const connectionSummary = githubState.activitySyncRunning
    ? "Running now"
    : githubState.activitySync
      ? `${githubState.activitySync.status} · ${githubState.activitySync.updatedAt}`
      : "Ready to sync";
  const accessibleRepositoryCount = githubState.installations.reduce(
    (count, installation) => count + installation.repositoryCount,
    0,
  );
  const compactFilters = dashboard
    ? [
        dashboard.filters[0],
        "Shipped work",
        dashboard.filters.at(-1),
      ].filter(Boolean)
    : [];

  return (
    <main className="page-shell min-h-screen">
      <ActivitySyncRefresh active={syncRefreshActive} />
      <div className="page-wash" />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <section className="top-panel">
          <div className="top-panel-copy">
            <span className="eyebrow">Vibe Tracker</span>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/" className="toggle-pill toggle-pill-active">
                Dashboard
              </Link>
              <Link href="/social" className="toggle-pill">
                Social
              </Link>
              <ThemeToggle />
            </div>
            <div className="space-y-3">
              <h1 className="page-title">Everyone is vibe coding, but how much?</h1>
              <p className="page-description">
                Track shipped work, recent trend, and repository impact without
                dragging the whole branch graph into storage.
              </p>
            </div>
          </div>

          <div className="top-panel-meta">
            <div className="meta-stack">
              <div className="meta-row">
                <span className="hero-meta-label">Connection</span>
                <span className="hero-meta-value">
                  {githubState.connected ? "GitHub connected" : "Not connected"}
                </span>
              </div>
              <div className="meta-row">
                <span className="hero-meta-label">Latest sync</span>
                <span className="hero-meta-value">{connectionSummary}</span>
              </div>
              <div className="meta-row">
                <span className="hero-meta-label">Connected repositories</span>
                <span className="hero-meta-value">
                  {formatNumber(accessibleRepositoryCount)}
                </span>
              </div>
            </div>

            <p className="hero-note">
              Repository access is cached locally. Activity sync refreshes merged pull request
              totals when you need a fresh snapshot without cloning repository code into the app.
            </p>

            <div className="hero-actions">
              <ConnectionAction href="/privacy" label="Read privacy breakdown" tone="secondary" />
              {!githubState.connected && githubState.primaryAction ? (
                <>
                  <ConnectionAction
                    href={githubState.primaryAction.href}
                    label={githubState.primaryAction.label}
                  />
                  <ConnectionAction
                    href="/api/session/reset"
                    label="Reset Session"
                    tone="secondary"
                  />
                </>
              ) : null}

              {githubState.connected && !hasInstallations ? (
                <ConnectionAction href="/api/github/install" label="Install GitHub App" />
              ) : null}

              {githubState.connected && hasInstallations ? (
                <form action="/api/github/activity-sync" method="post">
                  <button
                    type="submit"
                    className="button-secondary w-full sm:w-auto"
                    disabled={githubState.activitySyncRunning}
                  >
                    {githubState.activitySyncRunning ? "Syncing" : "Run shipped-work sync"}
                  </button>
                </form>
              ) : null}
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
            <TrustSection />

            <section id="dashboard" className="dashboard-shell">
              <div className="dashboard-head">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="eyebrow eyebrow-subtle">{dashboard.chartTitle}</span>
                    <span className="dashboard-pill">
                      {dashboard.profile.source === "live" ? "Live data" : "Sample data"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <h2 className="dashboard-title">{dashboard.profile.login}</h2>
                    <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                      {dashboard.profile.source === "live"
                        ? "These numbers come from synced merged pull request stats and daily shipped-work aggregates stored in the local database."
                        : "This is sample data that mirrors the shape of the live shipped-work metrics once GitHub activity has been synced."}
                    </p>
                  </div>
                </div>

                <div className="control-stack">
                  <div className="control-group">
                    {views.map((entry) => (
                      <Link
                        key={entry}
                        href={`/?view=${entry}&mode=${mode}`}
                        scroll={false}
                        className={entry === view ? "toggle-pill toggle-pill-active" : "toggle-pill"}
                      >
                        {entry[0]?.toUpperCase()}
                        {entry.slice(1)}
                      </Link>
                    ))}
                  </div>

                  <div className="filter-row">
                    {compactFilters.map((filter) => (
                      <span key={filter} className="filter-chip">
                        {filter}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <DashboardMetrics summary={dashboard.summary} />
            </section>

            <section className="story-panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="panel-label">{dashboard.chartTitle}</p>
                  <h3 className="panel-heading">Activity by time bucket</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="legend-pill">
                    <span className="legend-swatch legend-swatch-additions" />
                    Additions
                  </span>
                  <span className="legend-pill">
                    <span className="legend-swatch legend-swatch-deletions" />
                    Deletions
                  </span>
                </div>
              </div>

              {chartGeometry ? (
                <div className="mt-5 space-y-4">
                  <div className="chart-stat-row">
                    <article className="chart-stat-card">
                      <p className="panel-label">Peak additions</p>
                      <p className="chart-stat-value">
                        +{formatNumber(chartGeometry.maxAdditions)}
                      </p>
                    </article>
                    <article className="chart-stat-card">
                      <p className="panel-label">Peak deletions</p>
                      <p className="chart-stat-value">
                        -{formatNumber(chartGeometry.maxDeletions)}
                      </p>
                    </article>
                  </div>

                  <ActivityBarChart
                    chartGeometry={chartGeometry}
                    timelineLength={dashboard.timeline.length}
                    view={view}
                    chartTitle={dashboard.chartTitle}
                  />
                </div>
              ) : (
                <div className="mt-6 rounded-[1.4rem] border border-line bg-white/70 px-4 py-6 text-sm text-muted">
                  No timeline data available yet.
                </div>
              )}
            </section>

            <RepoSection
              repositories={dashboard.repositories}
              repoActivityMax={repoActivityMax}
              installations={githubState.installations}
              connected={githubState.connected}
              hasInstallations={hasInstallations}
              accessibleRepositoryCount={accessibleRepositoryCount}
            />
          </>
        ) : (
          <section id="dashboard" className="dashboard-shell">
            <div className="empty-shell">
              <div className="space-y-4">
                <span className="eyebrow eyebrow-subtle">Not connected</span>
                <h2 className="dashboard-title max-w-3xl">
                  No GitHub, no signal.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                  This dashboard only shows synced GitHub activity. Until the account is connected
                  and the first sync completes, there is nothing meaningful to read.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {CONNECT_STEPS.map((step, index) => (
                  <article key={step.title} className="onboarding-card">
                    <p className="panel-label">Step {index + 1}</p>
                    <h3 className="mt-3 text-2xl font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted">{step.detail}</p>
                  </article>
                ))}
              </div>

              <section className="story-panel">
                <p className="panel-label">Current state</p>
                <h3 className="panel-heading">{githubState.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{githubState.description}</p>
                {githubState.primaryAction ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <ConnectionAction href="/privacy" label="Read privacy breakdown" tone="secondary" />
                    <ConnectionAction
                      href={githubState.primaryAction.href}
                      label={githubState.primaryAction.label}
                    />
                    <ConnectionAction
                      href="/api/session/reset"
                      label="Reset Session"
                      tone="secondary"
                    />
                  </div>
                ) : null}
              </section>

              <TrustSection />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
