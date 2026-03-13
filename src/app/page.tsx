import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Github,
  LineChart,
  RefreshCcw,
  Sparkles,
  TimerReset,
} from "lucide-react";

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

function CompactMetric({
  label,
  value,
  detail,
  emphasized = false,
}: {
  label: string;
  value: string;
  detail: string;
  emphasized?: boolean;
}) {
  return (
    <article
      className={
        emphasized
          ? "compact-metric compact-metric-emphasized"
          : "compact-metric"
      }
    >
      <p className="compact-metric-label">{label}</p>
      <p className="compact-metric-value">{value}</p>
      <p className="compact-metric-detail">{detail}</p>
    </article>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "good" | "active";
}) {
  return (
    <span
      className={
        tone === "good"
          ? "status-chip status-chip-good"
          : tone === "active"
            ? "status-chip status-chip-active"
            : "status-chip"
      }
    >
      <span className="status-chip-dot" />
      {label}
    </span>
  );
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

  const topRepository = dashboard?.repositories[0] ?? null;
  const peakTimelinePoint =
    dashboard?.timeline.reduce((highest, point) => {
      const highestTotal = highest.additions + highest.deletions;
      const currentTotal = point.additions + point.deletions;
      return currentTotal > highestTotal ? point : highest;
    }) ?? null;
  const netOutput = dashboard
    ? dashboard.timeline.reduce(
        (total, point) => total + point.additions - point.deletions,
        0,
      )
    : 0;
  const visibleTimelineLabelStep =
    dashboard && dashboard.timeline.length > 8
      ? Math.ceil(dashboard.timeline.length / 6)
      : 1;
  const visibleRepos = dashboard?.repositories.slice(0, 5) ?? [];

  return (
    <main className="vibe-shell min-h-screen">
      <ActivitySyncRefresh active={syncRefreshActive} />
      <div className="vibe-grid" />
      <div className="vibe-ambient" />

      <div className="relative mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <section className="hero-frame">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Personal GitHub telemetry
            </div>

            <div className="space-y-5">
              <h1 className="hero-title">
                Read your actual coding signal, not a wall of decorative cards.
              </h1>
              <p className="hero-description">
                Vibe Tracker should feel like a concise operating board: one
                place for output, current sync health, and repository pressure
                without letting setup controls drown the analytics.
              </p>
            </div>

            <div className="hero-actions">
              {githubState.primaryAction ? (
                <ConnectionAction
                  href={githubState.primaryAction.href}
                  label={githubState.primaryAction.label}
                />
              ) : dashboard ? (
                <Link href="#dashboard" className="button-primary w-full sm:w-auto">
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}

              {dashboard ? (
                <Link
                  href={`/api/metrics?view=${view}&mode=${mode}`}
                  className="button-secondary w-full sm:w-auto"
                >
                  View metrics JSON
                  <LineChart className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="hero-sidekick">
            <div className="hero-sidekick-header">
              <div className="hero-sidekick-chip">
                <Sparkles className="h-4 w-4" />
                Session signal
              </div>
              <StatusChip
                label={
                  githubState.activitySyncRunning
                    ? "Sync running"
                    : githubState.connected
                      ? "Connected"
                      : "Needs setup"
                }
                tone={
                  githubState.activitySyncRunning
                    ? "active"
                    : githubState.connected
                      ? "good"
                      : "neutral"
                }
              />
            </div>

            <div className="hero-sidekick-grid">
              <div className="hero-kpi">
                <p className="panel-label">Window</p>
                <p className="hero-kpi-value">
                  {view[0]?.toUpperCase()}
                  {view.slice(1)}
                </p>
              </div>
              <div className="hero-kpi">
                <p className="panel-label">Mode</p>
                <p className="hero-kpi-value">
                  {mode === "authored" ? "Authored" : "Merged"}
                </p>
              </div>
              <div className="hero-kpi">
                <p className="panel-label">Installations</p>
                <p className="hero-kpi-value">{githubState.installations.length}</p>
              </div>
              <div className="hero-kpi">
                <p className="panel-label">Focus repo</p>
                <p className="hero-kpi-value">
                  {topRepository?.name.split("/")[1] ?? "Waiting"}
                </p>
              </div>
            </div>

            <p className="hero-sidekick-copy">
              The page now pushes the live signal up front and moves GitHub
              controls into a dedicated control rail so the analytics can lead.
            </p>
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

        <section
          id="dashboard"
          className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]"
        >
          <section className="workspace-panel">
            {dashboard ? (
              <>
                <header className="workspace-header">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="eyebrow eyebrow-subtle">
                        {dashboard.profile.source === "live"
                          ? "Live dashboard"
                          : "Sample dashboard"}
                      </span>
                      <span className="dashboard-tag">{dashboard.chartTitle}</span>
                    </div>

                    <div className="space-y-3">
                      <h2 className="dashboard-title">{dashboard.profile.login}</h2>
                      <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                        {dashboard.profile.source === "live"
                          ? "Synced commit records are deduped before aggregation, so this view is closer to an operating report than a vanity graph."
                          : "Local demo data that mirrors the model we will populate from the GitHub API during sync jobs."}
                      </p>
                    </div>
                  </div>

                  <div className="workspace-controls">
                    <div className="control-block">
                      <p className="control-label">Window</p>
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
                    </div>

                    <div className="control-block">
                      <p className="control-label">Attribution</p>
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
                    </div>

                    <div className="filter-row">
                      {dashboard.filters.map((filter) => (
                        <span key={filter} className="filter-chip">
                          {filter}
                        </span>
                      ))}
                    </div>
                  </div>
                </header>

                <section className="signal-row">
                  {dashboard.summary.map((item, index) => (
                    <CompactMetric
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      detail={item.detail}
                      emphasized={index === 0}
                    />
                  ))}
                </section>

                <div className="analysis-grid">
                  <section className="analysis-panel analysis-panel-chart">
                    <div className="panel-topline">
                      <div>
                        <p className="panel-label">Activity contour</p>
                        <h3 className="section-title">
                          Read the trend before you read the totals
                        </h3>
                      </div>
                      <div className="legend-row">
                        <span className="legend-chip">
                          <span className="legend-swatch legend-swatch-additions" />
                          Additions
                        </span>
                        <span className="legend-chip">
                          <span className="legend-swatch legend-swatch-deletions" />
                          Deletions
                        </span>
                      </div>
                    </div>

                    <div className="insight-row">
                      <div className="insight-card">
                        <p className="panel-label">Peak window</p>
                        <p className="insight-value">
                          {peakTimelinePoint?.label ?? "No data"}
                        </p>
                        <p className="insight-copy">
                          {peakTimelinePoint
                            ? `${formatNumber(
                                peakTimelinePoint.additions +
                                  peakTimelinePoint.deletions,
                              )} total changed lines`
                            : "No synced activity yet."}
                        </p>
                      </div>
                      <div className="insight-card">
                        <p className="panel-label">Net output</p>
                        <p className="insight-value">
                          {netOutput >= 0 ? "+" : ""}
                          {formatNumber(netOutput)}
                        </p>
                        <p className="insight-copy">
                          Additions minus deletions inside this selected window.
                        </p>
                      </div>
                    </div>

                    <div className="timeline-chart">
                      {dashboard.timeline.map((point, index) => (
                        <div key={point.label} className="timeline-column">
                          <div className="timeline-bars">
                            <div
                              className="timeline-bar timeline-bar-additions"
                              style={{ height: `${point.additionsHeight}%` }}
                            />
                            <div
                              className="timeline-bar timeline-bar-deletions"
                              style={{ height: `${point.deletionsHeight}%` }}
                            />
                          </div>
                          <div className="timeline-meta">
                            <p>
                              {index % visibleTimelineLabelStep === 0 ||
                              index === dashboard.timeline.length - 1
                                ? point.label
                                : " "}
                            </p>
                            <p className="font-mono text-foreground/80">
                              +{formatNumber(point.additions)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="analysis-panel">
                    <div className="panel-topline">
                      <div>
                        <p className="panel-label">Repository pressure</p>
                        <h3 className="section-title">
                          Where the work actually concentrated
                        </h3>
                      </div>
                      <span className="dashboard-tag">
                        {dashboard.repositories.length} repos
                      </span>
                    </div>

                    {topRepository ? (
                      <div className="repo-spotlight">
                        <p className="panel-label">Top repository</p>
                        <div className="repo-spotlight-row">
                          <div>
                            <h4 className="repo-spotlight-title">
                              {topRepository.name}
                            </h4>
                            <p className="repo-spotlight-copy">
                              {topRepository.detail}
                            </p>
                          </div>
                          <span className="repo-visibility">
                            {topRepository.visibility}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    <div className="repo-stack">
                      {visibleRepos.length > 0 ? (
                        visibleRepos.map((repo, index) => {
                          const totalActivity = repo.additions + repo.deletions;
                          const percent = topRepository
                            ? Math.round(
                                (totalActivity /
                                  (topRepository.additions +
                                    topRepository.deletions || 1)) *
                                  100,
                              )
                            : 0;

                          return (
                            <article key={repo.name} className="repo-card">
                              <div className="repo-card-head">
                                <div className="repo-title-group">
                                  <span className="repo-rank">
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <div>
                                    <h4 className="repo-name">{repo.name}</h4>
                                    <p className="repo-copy">{repo.detail}</p>
                                  </div>
                                </div>
                                <span className="repo-visibility">
                                  {repo.visibility}
                                </span>
                              </div>

                              <div className="repo-stats">
                                <span>+{formatNumber(repo.additions)}</span>
                                <span>-{formatNumber(repo.deletions)}</span>
                                <span>{repo.commitCount} commits</span>
                                <span>{percent}% of top-repo volume</span>
                              </div>

                              <div className="repo-meter">
                                <div
                                  className="repo-meter-fill"
                                  style={{ width: `${Math.max(percent, 8)}%` }}
                                />
                              </div>
                            </article>
                          );
                        })
                      ) : (
                        <article className="repo-card">
                          <h4 className="repo-name">No synced repositories yet</h4>
                          <p className="repo-copy">
                            Install the GitHub App on a user or organization,
                            refresh repositories, then run your first activity
                            sync.
                          </p>
                        </article>
                      )}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="empty-state-shell">
                <div className="space-y-4">
                  <span className="eyebrow eyebrow-subtle">Not connected</span>
                  <h2 className="dashboard-title max-w-3xl">
                    Connect GitHub before expecting any dashboard signal.
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                    This page should not fake momentum. Until GitHub is
                    connected and synced, there is nothing real to measure.
                  </p>
                </div>

                <div className="setup-grid">
                  {CONNECT_STEPS.map((step, index) => (
                    <article key={step.title} className="setup-card">
                      <p className="panel-label">Step {index + 1}</p>
                      <h3 className="setup-card-title">{step.title}</h3>
                      <p className="setup-card-copy">{step.detail}</p>
                    </article>
                  ))}
                </div>

                <section className="analysis-panel">
                  <p className="panel-label">Current state</p>
                  <h3 className="section-title">{githubState.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
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
            )}
          </section>

          <aside className="control-rail">
            <section className="rail-panel rail-panel-primary">
              <div className="panel-topline">
                <div>
                  <p className="panel-label">Control rail</p>
                  <h2 className="section-title section-title-rail">
                    GitHub connection and sync
                  </h2>
                </div>
                {githubState.connected ? (
                  <CheckCircle2 className="h-6 w-6 text-lime-300" />
                ) : (
                  <Github className="h-6 w-6 text-foreground/80" />
                )}
              </div>

              <div className="rail-status">
                <div>
                  <p className="rail-label">{githubState.title}</p>
                  <p className="rail-copy">{githubState.description}</p>
                </div>
                <StatusChip
                  label={
                    githubState.activitySyncRunning
                      ? "Sync running"
                      : githubState.connected
                        ? "Ready"
                        : "Offline"
                  }
                  tone={
                    githubState.activitySyncRunning
                      ? "active"
                      : githubState.connected
                        ? "good"
                        : "neutral"
                  }
                />
              </div>

              <div className="rail-actions">
                {githubState.primaryAction ? (
                  <ConnectionAction
                    href={githubState.primaryAction.href}
                    label={githubState.primaryAction.label}
                  />
                ) : null}
                {githubState.connected ? (
                  <form action="/api/github/activity-sync" method="post">
                    <button
                      type="submit"
                      className="button-secondary w-full"
                      disabled={githubState.activitySyncRunning}
                    >
                      {githubState.activitySyncRunning
                        ? "Sync in progress"
                        : "Sync my activity"}
                    </button>
                  </form>
                ) : null}
              </div>

              {githubState.viewer ? (
                <div className="rail-subpanel">
                  <p className="panel-label">Signed in as</p>
                  <p className="rail-user">{githubState.viewer.login}</p>
                  <div className="rail-meta-grid">
                    <div>
                      <p className="panel-label">Session</p>
                      <p className="rail-meta-copy">
                        Expires {githubState.viewer.sessionExpiryLabel}
                      </p>
                    </div>
                    <div>
                      <p className="panel-label">Latest activity sync</p>
                      <p className="rail-meta-copy">
                        {githubState.activitySync
                          ? `${githubState.activitySync.status} at ${githubState.activitySync.updatedAt}`
                          : "Not run yet"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rail-panel">
              <div className="panel-topline">
                <div>
                  <p className="panel-label">Installations</p>
                  <h2 className="section-title section-title-rail">
                    Connected scopes
                  </h2>
                </div>
                <RefreshCcw className="h-5 w-5 text-muted" />
              </div>

              <div className="installation-stack">
                {hasInstallations ? (
                  githubState.installations.map((installation) => (
                    <article key={installation.id} className="installation-card">
                      <div className="installation-head">
                        <div>
                          <h3 className="installation-title">
                            {installation.accountLogin}
                          </h3>
                          <p className="installation-copy">
                            {installation.repositoryCount} repos indexed locally
                          </p>
                        </div>
                        <span className="dashboard-tag">
                          #{installation.githubInstallId}
                        </span>
                      </div>

                      <p className="installation-copy installation-copy-break">
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
                    <h3 className="installation-title">Nothing installed yet</h3>
                    <p className="installation-copy">
                      Install the GitHub App on the account you want to measure.
                      That unlocks repository access for sync jobs.
                    </p>
                  </article>
                )}
              </div>
            </section>

            <section className="rail-panel rail-panel-quiet">
              <div className="panel-topline">
                <div>
                  <p className="panel-label">Model note</p>
                  <h2 className="section-title section-title-rail">
                    Why the totals hold up
                  </h2>
                </div>
                <ArrowUpRight className="h-4 w-4 text-accent" />
              </div>

              <p className="rail-copy">
                Repositories, branches, and pull requests are attribution
                layers around one canonical commit record. That prevents repo
                sprawl from inflating totals.
              </p>

              <div className="api-rule-card">
                <p className="panel-label">Core rule</p>
                <p className="api-rule-copy">
                  one commit SHA
                  <br />
                  equals one unit of work
                  <br />
                  regardless of branch count
                </p>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
