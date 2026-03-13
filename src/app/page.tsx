import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Github,
  LineChart,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

import { ActivitySyncRefresh } from "@/components/activity-sync-refresh";
import { formatNumber } from "@/lib/dashboard";
import type { AnalyticsView, MetricMode } from "@/lib/dashboard";
import { getGithubConnectionState } from "@/lib/github-state";
import { getLiveMetrics } from "@/lib/live-metrics";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type GithubState = Awaited<ReturnType<typeof getGithubConnectionState>>;
type DashboardData = NonNullable<Awaited<ReturnType<typeof getLiveMetrics>>>;

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
  "Install the GitHub App on the user or organization you want to measure.",
  "Run Sync my activity to load your vibe-coding totals.",
];

function HeroActions({
  dashboard,
  githubState,
  view,
  mode,
}: {
  dashboard: DashboardData | null;
  githubState: GithubState;
  view: AnalyticsView;
  mode: MetricMode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {githubState.primaryAction ? (
        <Link href={githubState.primaryAction.href} className="button-primary flex-1">
          {githubState.primaryAction.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : dashboard ? (
        <Link href="#dashboard" className="button-primary flex-1">
          Open dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}

      {dashboard ? (
        <Link
          href={`/api/metrics?view=${view}&mode=${mode}`}
          className="button-secondary flex-1"
        >
          View metrics JSON
          <LineChart className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

function DashboardSection({
  dashboard,
  githubState,
  view,
  mode,
  views,
  modes,
}: {
  dashboard: DashboardData;
  githubState: GithubState;
  view: AnalyticsView;
  mode: MetricMode;
  views: AnalyticsView[];
  modes: MetricMode[];
}) {
  return (
    <section className="grid gap-5">
      <section className="glass-panel-strong ambient-ring rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6 border-b border-line pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="section-label">
              {dashboard.profile.source === "live" ? "Live dashboard" : "Sample dashboard"}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {dashboard.profile.login}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted sm:text-base">
              {dashboard.profile.source === "live"
                ? "These metrics are aggregated from synced GitHub commits in the local database."
                : "Local demo data that mirrors the model we will populate from the GitHub API during sync jobs."}
            </p>
          </div>

          <div className="flex flex-col gap-3 text-sm">
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
                  className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-muted"
                >
                  {filter}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.summary.map((item) => (
            <article key={item.label} className="metric-card">
              <p className="text-sm text-muted">{item.label}</p>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.05em]">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{item.detail}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="soft-note relative overflow-hidden p-5 sm:p-6">
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(217,185,122,0.14),transparent_70%)]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-label text-accent">{dashboard.chartTitle}</p>
                  <h3 className="mt-2 text-xl font-semibold">Additions and deletions</h3>
                </div>
                <span className="rounded-full border border-line bg-background/40 px-3 py-1 text-xs text-muted">
                  Author date lens
                </span>
              </div>
              <div className="mt-6 overflow-x-auto pb-2">
                <div className="flex h-64 min-w-[42rem] items-end gap-3">
                  {dashboard.timeline.map((point) => (
                    <div key={point.label} className="flex min-w-0 flex-1 flex-col gap-3">
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
                          +{formatNumber(point.additions)} / -{formatNumber(point.deletions)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="soft-note p-5 sm:p-6">
            <p className="section-label">Repository breakdown</p>
            <div className="mt-4 max-h-[36rem] space-y-4 overflow-y-auto pr-1">
              {dashboard.repositories.length > 0 ? (
                dashboard.repositories.map((repo) => (
                  <article
                    key={repo.name}
                    className="rounded-[1.25rem] border border-line bg-background/35 px-4 py-4 transition-colors hover:bg-background/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{repo.name}</h3>
                        <p className="mt-1 text-sm leading-6 text-muted">{repo.detail}</p>
                      </div>
                      <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
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
                <article className="rounded-[1.25rem] border border-line bg-background/35 px-4 py-4">
                  <h3 className="font-semibold">No synced repositories yet</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Install the GitHub App on a user or organization, refresh repositories, then run your first activity sync.
                  </p>
                </article>
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
          <p className="section-label">Connection</p>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold tracking-[-0.04em]">{githubState.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{githubState.description}</p>
            </div>
            {githubState.connected ? (
              <CheckCircle2 className="mt-1 h-6 w-6 text-accent" />
            ) : (
              <Github className="mt-1 h-6 w-6 text-muted" />
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {githubState.primaryAction ? (
              <Link href={githubState.primaryAction.href} className="button-primary">
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
                  {githubState.activitySyncRunning ? "Sync in progress" : "Sync my activity"}
                </button>
              </form>
            ) : null}
          </div>
        </section>

        <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-label">Installations</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                {githubState.installations.length} connected scope
                {githubState.installations.length === 1 ? "" : "s"}
              </h3>
            </div>
            <RefreshCcw className="h-5 w-5 text-muted" />
          </div>

          <div className="mt-5 max-h-[28rem] space-y-4 overflow-y-auto pr-1">
            {githubState.installations.length > 0 ? (
              githubState.installations.map((installation) => (
                <article
                  key={installation.id}
                  className="rounded-[1.25rem] border border-line bg-background/35 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-semibold">{installation.accountLogin}</h4>
                      <p className="mt-1 text-sm text-muted">
                        {installation.repositoryCount} repos indexed locally
                      </p>
                    </div>
                    <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
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
                    <button type="submit" className="button-secondary px-4 py-2">
                      Refresh repositories
                    </button>
                  </form>
                </article>
              ))
            ) : (
              <article className="rounded-[1.25rem] border border-line bg-background/35 p-4">
                <h4 className="font-semibold">Nothing installed yet</h4>
                <p className="mt-2 text-sm leading-6 text-muted">
                  After you connect GitHub, install the app on the account you want to measure. That unlocks repository access and lets the sync job pull your activity.
                </p>
              </article>
            )}
          </div>
        </section>
      </section>
    </section>
  );
}

function DisconnectedSection({ githubState }: { githubState: GithubState }) {
  return (
    <section className="glass-panel-strong ambient-ring rounded-[2rem] p-6 sm:p-8">
      <div className="max-w-2xl">
        <p className="section-label">Not connected</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          Connect GitHub once. Everything else gets simpler.
        </h2>
        <p className="mt-4 text-base leading-8 text-muted">
          The app is strongest when the path is obvious: connect your account, install the app on the scope you care about, then run a sync to load real totals.
        </p>
      </div>

      <div className="surface-divider mt-8 pt-8">
        <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <section className="soft-note p-5 sm:p-6">
            <p className="section-label">Current state</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{githubState.title}</h3>
            <p className="mt-3 text-sm leading-7 text-muted">{githubState.description}</p>
            {githubState.primaryAction ? (
              <div className="mt-6">
                <Link href={githubState.primaryAction.href} className="button-primary">
                  {githubState.primaryAction.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </section>

          <section className="grid gap-3">
            {CONNECT_STEPS.map((step, index) => (
              <article key={step} className="soft-note flex items-start gap-4 p-4 sm:p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 text-sm font-semibold text-accent">
                  0{index + 1}
                </div>
                <div>
                  <p className="section-label">Step {index + 1}</p>
                  <p className="mt-2 text-lg font-semibold leading-7 text-foreground">{step}</p>
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
    </section>
  );
}

function Sidebar({ githubState, hasInstallations }: { githubState: GithubState; hasInstallations: boolean }) {
  return (
    <aside className="flex flex-col gap-4">
      <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-label">Connection summary</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
              {githubState.title}
            </h2>
          </div>
          {githubState.connected ? (
            <CheckCircle2 className="mt-1 h-6 w-6 text-accent" />
          ) : (
            <Github className="mt-1 h-6 w-6 text-muted" />
          )}
        </div>
        <p className="mt-3 text-sm leading-7 text-muted">{githubState.description}</p>

        {githubState.viewer ? (
          <div className="soft-note mt-5 p-4">
            <p className="section-label">Signed in as</p>
            <p className="mt-2 text-lg font-semibold">{githubState.viewer.login}</p>
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

      <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-label">Installations</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
              {githubState.installations.length} connected scope
              {githubState.installations.length === 1 ? "" : "s"}
            </h2>
          </div>
          <RefreshCcw className="h-5 w-5 text-muted" />
        </div>

        <div className="mt-5 max-h-[28rem] space-y-4 overflow-y-auto pr-1">
          {hasInstallations ? (
            githubState.installations.map((installation) => (
              <article
                key={installation.id}
                className="rounded-[1.25rem] border border-line bg-background/35 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{installation.accountLogin}</h3>
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
                  <button type="submit" className="button-secondary px-4 py-2">
                    Refresh repositories
                  </button>
                </form>
              </article>
            ))
          ) : (
            <article className="rounded-[1.25rem] border border-line bg-background/35 p-4">
              <h3 className="font-semibold">Nothing installed yet</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                After you connect GitHub, install the app on the account you want to measure. That unlocks repository access and lets the sync job pull your activity.
              </p>
            </article>
          )}
        </div>
      </section>

      <section className="glass-panel rounded-[1.75rem] p-5 sm:p-6">
        <p className="section-label">Model integrity</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
          One commit SHA stays one unit of work.
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          Repositories, branches, and pull requests are attribution layers around a canonical commit record. That keeps the analytics honest as the repo graph grows.
        </p>
        <div className="soft-note mt-5 p-4">
          <p className="section-label">Core rule</p>
          <p className="mt-3 font-mono text-sm leading-7 text-foreground/85">
            one commit SHA
            <br />
            = one unit of work
            <br />
            regardless of branch count
          </p>
        </div>
      </section>
    </aside>
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
  const dashboard = githubState.connected ? await getLiveMetrics(view, mode) : null;
  const githubStatus = typeof params.github === "string" ? params.github : undefined;
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

  return (
    <main className="grid-lines min-h-screen">
      <ActivitySyncRefresh active={syncRefreshActive} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <header className="hero-shell glass-panel ambient-ring rounded-[2rem] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="eyebrow">Vibe Tracker</span>
              <h1 className="display-face mt-6 max-w-4xl text-5xl leading-[0.92] sm:text-6xl lg:text-7xl">
                Elegant signal for how much you actually shipped.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-muted sm:text-lg">
                Connect GitHub once, sync your activity, and get a clean read on output across repositories without inflating the numbers with duplicate commit counts.
              </p>
            </div>

            <div className="w-full max-w-md space-y-4">
              <div className="soft-note p-5">
                <p className="section-label">What you get</p>
                <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-3">
                  <div>
                    <p className="text-xl font-semibold text-foreground">01</p>
                    <p className="mt-2 leading-6">Connection state that is explicit, not noisy.</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-foreground">02</p>
                    <p className="mt-2 leading-6">Real commit totals with deduped attribution.</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-foreground">03</p>
                    <p className="mt-2 leading-6">Repo-level context when you need the detail.</p>
                  </div>
                </div>
              </div>

              <HeroActions
                dashboard={dashboard}
                githubState={githubState}
                view={view}
                mode={mode}
              />
            </div>
          </div>
        </header>

        {githubStatus ? (
          <section className="status-note ambient-ring px-5 py-4 text-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 text-accent" />
                <span>
                  GitHub status:{" "}
                  <span className="font-semibold">{githubStatusCopy?.label ?? githubStatus}</span>
                </span>
              </p>
              {githubStatusCopy?.detail ? (
                <p className="max-w-2xl text-muted sm:text-right">{githubStatusCopy.detail}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section id="dashboard" className="grid gap-6 xl:grid-cols-[1.22fr_0.78fr]">
          <section className="grid gap-6">
            {dashboard ? (
              <DashboardSection
                dashboard={dashboard}
                githubState={githubState}
                view={view}
                mode={mode}
                views={views}
                modes={modes}
              />
            ) : (
              <DisconnectedSection githubState={githubState} />
            )}
          </section>

          <Sidebar githubState={githubState} hasInstallations={hasInstallations} />
        </section>
      </div>
    </main>
  );
}
