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

function MetricCard({
  label,
  value,
  detail,
  featured = false,
}: {
  label: string;
  value: string;
  detail: string;
  featured?: boolean;
}) {
  return (
    <article
      className={featured ? "metric-card metric-card-featured" : "metric-card"}
    >
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </article>
  );
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

  return (
    <main className="aurora-shell min-h-screen">
      <ActivitySyncRefresh active={syncRefreshActive} />
      <div className="page-grid" />
      <div className="page-noise" />

      <div className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
        <section className="hero-panel">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Personal GitHub telemetry
            </div>
            <div className="space-y-5">
              <h1 className="hero-title">
                Stop guessing whether you shipped. Read the signal.
              </h1>
              <p className="hero-description">
                Vibe Tracker turns your GitHub history into a live operating
                board for authored output, sync health, and repository-level
                momentum.
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

          <div className="hero-spotlight">
            <div className="spotlight-ring" />
            <div className="hero-stat-card">
              <div className="hero-stat-chip">
                <Sparkles className="h-4 w-4" />
                Live coding pulse
              </div>
              <div className="space-y-4">
                <div>
                  <p className="panel-label">Current lens</p>
                  <p className="hero-stat-value">
                    {view[0]?.toUpperCase()}
                    {view.slice(1)} · {mode === "authored" ? "Authored" : "Merged"}
                  </p>
                </div>
                <div className="hero-stat-grid">
                  <div>
                    <p className="panel-label">Tracked scopes</p>
                    <p className="panel-value">
                      {githubState.installations.length || "0"}
                    </p>
                  </div>
                  <div>
                    <p className="panel-label">Sync state</p>
                    <p className="panel-value">
                      {githubState.activitySyncRunning ? "Running" : "Ready"}
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-6 text-muted">
                  The dashboard stays grounded in deduped commit records, so repo
                  counts can grow without inflating totals.
                </p>
              </div>
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

        <section
          id="dashboard"
          className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_400px]"
        >
          <section className="dashboard-shell">
            {dashboard ? (
              <>
                <div className="dashboard-head">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="eyebrow eyebrow-subtle">
                        {dashboard.profile.source === "live"
                          ? "Live dashboard"
                          : "Sample dashboard"}
                      </span>
                      <span className="dashboard-pill">
                        {dashboard.chartTitle}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <h2 className="dashboard-title">
                        {dashboard.profile.login}
                      </h2>
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
                    <MetricCard
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      detail={item.detail}
                      featured={index === 0}
                    />
                  ))}
                </div>

                <div className="mt-6 grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <section className="story-panel">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="panel-label text-accent">
                          Output contour
                        </p>
                        <h3 className="panel-heading">
                          Additions and deletions over time
                        </h3>
                      </div>
                      <span className="dashboard-pill">Author date lens</span>
                    </div>

                    <div className="timeline-shell">
                      <div className="timeline-ruler">
                        <span>Peak</span>
                        <span>Mid</span>
                        <span>Now</span>
                      </div>
                      <div className="timeline-chart">
                        {dashboard.timeline.map((point) => (
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
                              <p>{point.label}</p>
                              <p className="font-mono text-foreground/80">
                                +{formatNumber(point.additions)} / -
                                {formatNumber(point.deletions)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

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
                          const totalActivity =
                            repo.additions + repo.deletions;
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
                                <span className="repo-visibility">
                                  {repo.visibility}
                                </span>
                              </div>

                              <div className="mt-4 space-y-3">
                                <div className="repo-meter">
                                  <div
                                    className="repo-meter-fill"
                                    style={{ width }}
                                  />
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
              <div className="flex h-full flex-col gap-8">
                <div className="space-y-4">
                  <span className="eyebrow eyebrow-subtle">Not connected</span>
                  <h2 className="dashboard-title max-w-3xl">
                    Connect GitHub before expecting any dashboard signal.
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                    This product does not simulate activity for you. Until
                    GitHub is connected and synced, there is nothing real to
                    measure.
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
            )}
          </section>

          <aside className="flex flex-col gap-6">
            <section className="sidebar-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="panel-label">Connection</p>
                  <h2 className="panel-heading text-[1.8rem]">
                    {githubState.title}
                  </h2>
                </div>
                {githubState.connected ? (
                  <CheckCircle2 className="h-6 w-6 text-lime-300" />
                ) : (
                  <Github className="h-6 w-6 text-foreground/80" />
                )}
              </div>

              <p className="mt-3 text-sm leading-6 text-muted">
                {githubState.description}
              </p>

              <div className="mt-6 flex flex-col gap-3">
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
                <div className="sidebar-subpanel">
                  <p className="panel-label">Signed in as</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {githubState.viewer.login}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Session expires {githubState.viewer.sessionExpiryLabel}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-muted">
                    Latest activity sync:{" "}
                    {githubState.activitySync
                      ? `${githubState.activitySync.status} at ${githubState.activitySync.updatedAt}`
                      : "not run yet"}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="sidebar-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="panel-label">Installations</p>
                  <h2 className="panel-heading text-[1.8rem]">
                    {githubState.installations.length} connected scope
                    {githubState.installations.length === 1 ? "" : "s"}
                  </h2>
                </div>
                <RefreshCcw className="h-5 w-5 text-muted" />
              </div>

              <div className="mt-5 max-h-[42rem] space-y-4 overflow-y-auto pr-1">
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
                        <span className="dashboard-pill">
                          #{installation.githubInstallId}
                        </span>
                      </div>

                      <p className="mt-4 break-words text-sm leading-6 text-muted">
                        {installation.repositoryNames.length > 0
                          ? installation.repositoryNames.join(", ")
                          : "No repositories cached yet. Refresh repositories to pull grants."}
                      </p>

                      <form
                        action={`/api/github/installations/${installation.githubInstallId}/sync`}
                        method="post"
                        className="mt-5"
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
                      After you connect GitHub, install the app on the account
                      you want to measure. That unlocks repository access and
                      lets the sync job pull your activity.
                    </p>
                  </article>
                )}
              </div>
            </section>

            <section className="sidebar-panel sidebar-panel-accent">
              <div className="flex items-center justify-between gap-3">
                <span className="eyebrow eyebrow-subtle">API sample</span>
                <ArrowUpRight className="h-4 w-4 text-accent" />
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                Why the model scales
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Repositories, branches, and pull requests are attribution
                layers around one canonical commit record. That keeps the API
                honest as repo count grows.
              </p>
              <div className="api-card">
                <p className="panel-label">Core rule</p>
                <p className="mt-3 font-mono text-sm leading-6 text-foreground/90">
                  one commit SHA
                  <br />
                  = one unit of work
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
