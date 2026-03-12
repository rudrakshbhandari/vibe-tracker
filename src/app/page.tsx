import Link from "next/link";
import { ArrowRight, CheckCircle2, Github, LineChart, RefreshCcw } from "lucide-react";

import { formatNumber } from "@/lib/dashboard";
import type { AnalyticsView, MetricMode } from "@/lib/dashboard";
import { getGithubConnectionState } from "@/lib/github-state";
import { getLiveMetrics } from "@/lib/live-metrics";
import { ActivitySyncRefresh } from "@/components/activity-sync-refresh";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
const GITHUB_STATUS_COPY: Record<
  string,
  { label: string; detail?: string }
> = {
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
  "Install the GitHub App on the user or organization you want to measure.",
  "Run Sync my activity to load your vibe-coding totals.",
];

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
    ? GITHUB_STATUS_COPY[githubStatus] ?? {
        label: githubStatus,
      }
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

  return (
    <main className="grid-lines min-h-screen">
      <ActivitySyncRefresh active={syncRefreshActive} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="glass-panel rounded-[2rem] px-6 py-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center gap-3 text-sm font-medium uppercase tracking-[0.24em] text-muted">
                <span className="rounded-full border border-line px-3 py-1">
                  Vibe Tracker
                </span>
                <span>See how much you are vibe coding</span>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
                  Your coding output, pulled from GitHub.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
                  Connect GitHub, sync your activity, and see lines changed and repository breakdowns without duplicate commit counting.
                </p>
              </div>
            </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {githubState.primaryAction ? (
                <Link href={githubState.primaryAction.href} className="button-primary">
                  {githubState.primaryAction.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : dashboard ? (
                <Link href="#dashboard" className="button-primary">
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
              {dashboard ? (
                <Link
                  href={`/api/metrics?view=${view}&mode=${mode}`}
                  className="button-secondary"
                >
                  View metrics JSON
                  <LineChart className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        {githubStatus ? (
          <section className="glass-panel rounded-[1.5rem] px-5 py-4 text-sm text-muted">
            <p>
              GitHub status:{" "}
              <span className="font-semibold text-foreground">
                {githubStatusCopy?.label ?? githubStatus}
              </span>
            </p>
            {githubStatusCopy?.detail && (
              <p className="mt-2 max-w-3xl leading-6">{githubStatusCopy.detail}</p>
            )}
          </section>
        ) : null}

        <section id="dashboard" className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <section className="rounded-[2rem] border border-line bg-panel p-6 shadow-[0_24px_80px_rgba(72,56,31,0.08)] backdrop-blur">
            {dashboard ? (
              <>
                <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-muted">
                      {dashboard.profile.source === "live"
                        ? "Live dashboard"
                        : "Sample dashboard"}
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                      {dashboard.profile.login}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                      {dashboard.profile.source === "live"
                        ? "These metrics are aggregated from synced GitHub commits in the local database."
                        : "Local demo data that mirrors the model we will populate from the GitHub API during sync jobs."}
                    </p>
                  </div>
              <div className="flex flex-col gap-3 text-sm sm:items-end">
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
                <div className="flex flex-wrap gap-2">
                  {dashboard.filters.map((filter) => (
                    <span
                      key={filter}
                      className="rounded-full border border-line px-3 py-1.5 font-medium text-muted"
                    >
                      {filter}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {dashboard.summary.map((item) => (
                <article
                  key={item.label}
                  className="glass-panel-strong rounded-[1.5rem] p-4 transition-transform hover:-translate-y-1"
                >
                  <p className="text-sm text-muted">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm text-muted">{item.detail}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="glass-panel-strong relative overflow-hidden rounded-[1.5rem] p-5">
                <div className="absolute inset-0 bg-accent/5 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-accent">
                        {dashboard.chartTitle}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold">
                        Additions and deletions
                      </h3>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                      Author date lens
                    </span>
                  </div>
                  <div className="mt-6 flex h-64 items-end gap-3">
                  {dashboard.timeline.map((point) => (
                    <div key={point.label} className="flex flex-1 flex-col gap-3">
                      <div className="flex h-48 items-end gap-1">
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
                        <p className="font-mono text-xs text-foreground/80">
                          +{formatNumber(point.additions)} / -
                          {formatNumber(point.deletions)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </section>

              <section className="glass-panel-strong rounded-[1.5rem] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">
                  Repository breakdown
                </p>
                <div className="mt-4 space-y-4">
                  {dashboard.repositories.map((repo) => (
                    <article
                      key={repo.name}
                      className="rounded-[1.25rem] border border-line bg-background/40 px-4 py-3 transition-colors hover:bg-background/60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">{repo.name}</h3>
                          <p className="mt-1 text-sm text-muted">{repo.detail}</p>
                        </div>
                        <span className="rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-xs font-medium text-accent">
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
                  <article className="rounded-[1.25rem] border border-line bg-background/40 px-4 py-3">
                    <h3 className="font-semibold">No synced repositories yet</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Install the GitHub App on a user or organization, refresh repositories, then run your first activity sync.
                    </p>
                  </article>
                )}
              </div>
            </section>
          </div>
          </>
        ) : (
              <div className="flex h-full flex-col justify-between gap-8">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-muted">
                    Not connected
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                    Connect GitHub to see your vibe-coding totals.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                    This app only shows real GitHub activity. Until GitHub is connected, there is nothing to calculate.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {CONNECT_STEPS.map((step, index) => (
                    <article
                      key={step}
                      className="rounded-[1.5rem] border border-line bg-panel-strong p-4"
                    >
                      <p className="text-sm text-muted">Step {index + 1}</p>
                      <p className="mt-3 text-lg font-semibold">{step}</p>
                    </article>
                  ))}
                </div>

                <div className="rounded-[1.5rem] border border-line bg-[#fffaf0] p-5">
                  <p className="text-sm font-semibold text-foreground">
                    Current state: {githubState.title}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                    {githubState.description}
                  </p>
                  {githubState.primaryAction ? (
                    <div className="mt-4">
                      <Link href={githubState.primaryAction.href} className="button-primary">
                        {githubState.primaryAction.label}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-6">
            <section className="glass-panel-strong rounded-[2rem] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-muted">
                    Connection
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                    {githubState.title}
                  </h2>
                </div>
                {githubState.connected ? (
                  <CheckCircle2 className="h-6 w-6 text-accent-2" />
                ) : (
                  <Github className="h-6 w-6" />
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                {githubState.description}
              </p>

              <div className="mt-5 flex flex-col gap-3">
                {githubState.primaryAction ? (
                  <Link
                    href={githubState.primaryAction.href}
                    className="button-primary"
                  >
                    {githubState.primaryAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
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
                <div className="mt-6 rounded-[1.25rem] border border-line bg-panel-strong p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">
                    Signed in as
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {githubState.viewer.login}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Session expires {githubState.viewer.sessionExpiryLabel}
                  </p>
                  <p className="mt-3 text-sm text-muted">
                    Latest activity sync:{" "}
                    {githubState.activitySync
                      ? `${githubState.activitySync.status} at ${githubState.activitySync.updatedAt}`
                      : "not run yet"}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="glass-panel-strong rounded-[2rem] p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-muted">
                Installations
              </p>
              <div className="flex items-center justify-between gap-3">
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  {githubState.installations.length} connected scope
                  {githubState.installations.length === 1 ? "" : "s"}
                </h2>
                <RefreshCcw className="h-5 w-5 text-muted" />
              </div>

              <div className="mt-5 max-h-[40rem] space-y-4 overflow-y-auto pr-1">
                {hasInstallations ? (
                  githubState.installations.map((installation) => (
                    <article
                      key={installation.id}
                      className="glass-panel rounded-[1.25rem] p-4 transition-transform hover:-translate-y-1"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">
                            {installation.accountLogin}
                          </h3>
                          <p className="mt-1 text-sm text-muted">
                            {installation.repositoryCount} repos indexed locally
                          </p>
                        </div>
                        <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">
                          #{installation.githubInstallId}
                        </span>
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
                        <button
                          type="submit"
                          className="button-secondary px-4 py-2"
                        >
                          Refresh repositories
                        </button>
                      </form>
                    </article>
                  ))
                ) : (
                  <article className="rounded-[1.25rem] border border-line bg-panel p-4">
                    <h3 className="font-semibold">Nothing installed yet</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      After you connect GitHub, install the app on the account you want to measure. That unlocks repository access and lets the sync job pull your activity.
                    </p>
                  </article>
                )}
              </div>
            </section>

            <section className="glass-panel-strong relative overflow-hidden rounded-[2rem] p-6">
              <div className="absolute inset-0 bg-accent-2/5 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-accent">
                    API sample
                  </div>
                </div>
                <h2 className="mt-4 text-lg font-semibold">Why the model scales</h2>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Repositories, branches, and pull requests are just attribution
                  layers around one canonical commit record. That keeps the API
                  honest as repo count grows.
                </p>
                <div className="mt-5 rounded-[1.25rem] border border-line bg-background/50 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                    Core rule
                  </p>
                  <p className="mt-3 font-mono text-sm text-foreground/90">
                    one commit SHA
                    <br />
                    = one unit of work
                    <br />
                    regardless of branch count
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
