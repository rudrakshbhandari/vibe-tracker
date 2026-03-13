import Link from "next/link";
import { ArrowRight, CheckCircle2, Github, LineChart, RefreshCcw } from "lucide-react";

import { ActivitySyncRefresh } from "@/components/activity-sync-refresh";
import type { AnalyticsView, MetricMode } from "@/lib/dashboard";
import { formatNumber } from "@/lib/dashboard";
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
  "Connect your GitHub account.",
  "Install the GitHub App on the scope you want to track.",
  "Run a sync to load your coding totals.",
];

const views: AnalyticsView[] = ["daily", "weekly", "monthly"];
const modes: MetricMode[] = ["authored", "merged"];

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
  const hasInstallations = githubState.installations.length > 0;
  const syncRefreshActive = Boolean(
    githubStatus === "activity-sync-started" ||
      githubStatus === "activity-sync-running" ||
      githubState.activitySyncRunning ||
      dashboard?.activitySyncRunning,
  );

  return (
    <main className="grid-lines min-h-screen">
      <ActivitySyncRefresh active={syncRefreshActive} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="glass-panel rounded-[1.75rem] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">
                  <span className="rounded-full border border-line px-3 py-1">
                    Vibe Tracker
                  </span>
                  <span className="rounded-full border border-line px-3 py-1">
                    Core dashboard
                  </span>
                  <span className="rounded-full border border-line px-3 py-1">
                    {githubState.connected ? "GitHub connected" : "Not connected"}
                  </span>
                </div>
                <div className="space-y-2">
                  <h1 className="max-w-3xl text-2xl font-semibold tracking-[-0.05em] sm:text-4xl">
                    Read the signal, not the chrome.
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted sm:text-base">
                    Your output, timeline, repositories, and sync state. Everything
                    else got out of the way.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                {githubState.primaryAction ? (
                  <Link href={githubState.primaryAction.href} className="button-primary">
                    {githubState.primaryAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
                {dashboard ? (
                  <Link
                    href={`/api/metrics?view=${view}&mode=${mode}`}
                    className="button-secondary"
                  >
                    Metrics JSON
                    <LineChart className="h-4 w-4" />
                  </Link>
                ) : null}
                {githubState.connected ? (
                  <form action="/api/github/activity-sync" method="post">
                    <button
                      type="submit"
                      className="button-secondary"
                      disabled={githubState.activitySyncRunning}
                    >
                      {githubState.activitySyncRunning ? "Syncing" : "Sync now"}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
              <section className="rounded-[1.25rem] border border-line bg-panel-strong px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                  Identity
                </p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold tracking-[-0.05em]">
                      {dashboard?.profile.login ?? githubState.viewer?.login ?? "Connect GitHub"}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {dashboard
                        ? "Live GitHub metrics in the current view."
                        : githubState.description}
                    </p>
                  </div>
                  {githubState.connected ? (
                    <CheckCircle2 className="mt-1 h-5 w-5 text-accent-2" />
                  ) : (
                    <Github className="mt-1 h-5 w-5 text-muted" />
                  )}
                </div>
              </section>

              <section className="rounded-[1.25rem] border border-line bg-panel-strong px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                  Connection
                </p>
                <p className="mt-2 text-lg font-semibold">{githubState.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {githubState.viewer
                    ? `Session ${githubState.viewer.sessionExpiryLabel}`
                    : "Sign in to unlock live metrics."}
                </p>
              </section>

              <section className="rounded-[1.25rem] border border-line bg-panel-strong px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                  Sync
                </p>
                <p className="mt-2 text-lg font-semibold">
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

              <section className="rounded-[1.25rem] border border-line bg-panel-strong px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                  Installations
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {githubState.installations.length} scope
                  {githubState.installations.length === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {hasInstallations ? "Repository access cached locally." : "No scopes installed yet."}
                </p>
              </section>
            </div>
          </div>
        </header>

        {githubStatus ? (
          <section className="glass-panel rounded-[1.25rem] px-4 py-3 text-sm text-muted">
            <p>
              GitHub status:{" "}
              <span className="font-semibold text-foreground">
                {githubStatusCopy?.label ?? githubStatus}
              </span>
            </p>
            {githubStatusCopy?.detail ? (
              <p className="mt-1 leading-6">{githubStatusCopy.detail}</p>
            ) : null}
          </section>
        ) : null}

        {dashboard ? (
          <>
            <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {views.map((entry) => (
                      <Link
                        key={entry}
                        href={`/?view=${entry}&mode=${mode}`}
                        className={entry === view ? "toggle-pill toggle-pill-active" : "toggle-pill"}
                      >
                        {entry[0]?.toUpperCase()}
                        {entry.slice(1)}
                      </Link>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {modes.map((entry) => (
                      <Link
                        key={entry}
                        href={`/?view=${view}&mode=${entry}`}
                        className={entry === mode ? "toggle-pill toggle-pill-active" : "toggle-pill"}
                      >
                        {entry === "authored" ? "Authored" : "Merged"}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {dashboard.filters.map((filter) => (
                    <span
                      key={filter}
                      className="rounded-full border border-line px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      {filter}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {dashboard.summary.map((item) => (
                  <article
                    key={item.label}
                    className="rounded-[1.25rem] border border-line bg-panel-strong px-4 py-4"
                  >
                    <p className="text-sm text-muted">{item.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                      {item.value}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted">{item.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-accent">
                    {dashboard.chartTitle}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                    Activity trend
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Additions and deletions across the selected time window.
                  </p>
                </div>
                <span className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted">
                  Author date lens
                </span>
              </div>

              <div className="mt-8 flex h-[22rem] items-end gap-2 sm:gap-3">
                {dashboard.timeline.map((point) => (
                  <div key={point.label} className="flex flex-1 flex-col gap-3">
                    <div className="flex h-[17rem] items-end gap-1 sm:gap-1.5">
                      <div
                        className="w-1/2 rounded-t-full bg-accent"
                        style={{ height: `${point.additionsHeight}%` }}
                      />
                      <div
                        className="w-1/2 rounded-t-full bg-accent-2"
                        style={{ height: `${point.deletionsHeight}%` }}
                      />
                    </div>
                    <div className="space-y-1 text-center">
                      <p className="text-xs text-muted">{point.label}</p>
                      <p className="font-mono text-[11px] text-foreground/80 sm:text-xs">
                        +{formatNumber(point.additions)} / -{formatNumber(point.deletions)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
              <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted">
                      Repository breakdown
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                      Where the work landed
                    </h2>
                  </div>
                  <span className="rounded-full border border-line px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted">
                    {dashboard.repositories.length} repos
                  </span>
                </div>

                <div className="mt-5 max-h-[44rem] space-y-3 overflow-y-auto pr-1">
                  {dashboard.repositories.length > 0 ? (
                    dashboard.repositories.map((repo) => (
                      <article
                        key={repo.name}
                        className="rounded-[1.25rem] border border-line bg-panel-strong px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold">{repo.name}</h3>
                            <p className="mt-1 text-sm leading-6 text-muted">{repo.detail}</p>
                          </div>
                          <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-accent">
                            {repo.visibility}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
                          <span>+{formatNumber(repo.additions)}</span>
                          <span>-{formatNumber(repo.deletions)}</span>
                          <span>{repo.commitCount} commits</span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <article className="rounded-[1.25rem] border border-line bg-panel-strong px-4 py-4">
                      <h3 className="font-semibold">No synced repositories yet</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        Install the GitHub App on a user or organization, refresh repositories,
                        then run your first activity sync.
                      </p>
                    </article>
                  )}
                </div>
              </section>

              <aside className="flex flex-col gap-5">
                <section className="glass-panel rounded-[1.75rem] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted">
                        Account
                      </p>
                      <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">
                        {githubState.viewer?.login ?? "Not signed in"}
                      </h2>
                    </div>
                    {githubState.connected ? (
                      <CheckCircle2 className="h-5 w-5 text-accent-2" />
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

                <section className="glass-panel rounded-[1.75rem] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted">
                        Installations
                      </p>
                      <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">
                        {githubState.installations.length} connected scope
                        {githubState.installations.length === 1 ? "" : "s"}
                      </h2>
                    </div>
                    <RefreshCcw className="h-4 w-4 text-muted" />
                  </div>

                  <div className="mt-4 space-y-3">
                    {hasInstallations ? (
                      githubState.installations.map((installation) => (
                        <article
                          key={installation.id}
                          className="rounded-[1.25rem] border border-line bg-panel-strong px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold">{installation.accountLogin}</h3>
                              <p className="mt-1 text-sm text-muted">
                                {installation.repositoryCount} repos indexed locally
                              </p>
                            </div>
                            <span className="rounded-full border border-line px-3 py-1 text-[11px] font-medium text-muted">
                              #{installation.githubInstallId}
                            </span>
                          </div>
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
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
                      <article className="rounded-[1.25rem] border border-line bg-panel-strong px-4 py-4">
                        <h3 className="font-semibold">Nothing installed yet</h3>
                        <p className="mt-2 text-sm leading-6 text-muted">
                          Install the GitHub App on the account you want to measure to unlock
                          repository-level metrics.
                        </p>
                      </article>
                    )}
                  </div>
                </section>
              </aside>
            </section>
          </>
        ) : (
          <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted">
                  Not connected
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  Connect GitHub to unlock the main screen.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                  The app only shows real GitHub activity. Once connected, the homepage
                  collapses to your identity, key stats, full-width activity trend, and
                  repository output.
                </p>
                {githubState.primaryAction ? (
                  <div className="mt-5">
                    <Link href={githubState.primaryAction.href} className="button-primary">
                      {githubState.primaryAction.label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3">
                {CONNECT_STEPS.map((step, index) => (
                  <article
                    key={step}
                    className="rounded-[1.25rem] border border-line bg-panel-strong px-4 py-4"
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-muted">
                      Step {index + 1}
                    </p>
                    <p className="mt-2 text-lg font-semibold">{step}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
