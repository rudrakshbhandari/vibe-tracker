import Link from "next/link";
import { ArrowRight, CheckCircle2, Github, RefreshCcw, ShieldCheck, TimerReset } from "lucide-react";

import { ActivityBarChart } from "@/components/activity-bar-chart";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  fetchCloudflareReadJson,
  hasCloudflareWorkerProxy,
} from "@/lib/cloudflare-read";
import { formatNumber } from "@/lib/dashboard";
import type { AnalyticsView, MetricMode } from "@/lib/dashboard";
import {
  normalizeGithubState,
  type GithubState,
  type GithubStateInstallation,
  type SyncHealthSummary,
} from "@/lib/github-state-normalize";
import { getLinkPrefetch } from "@/lib/link-prefetch";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const GITHUB_STATUS_COPY: Record<string, { label: string; detail?: string }> = {
  "activity-sync-started": {
    label: "Activity sync started",
    detail:
      "The sync was queued successfully in the Cloudflare worker. Refresh the page in a moment if the latest totals have not landed yet.",
  },
  "activity-sync-running": {
    label: "Activity sync already running",
    detail:
      "A sync is already in progress for this account. Refresh again after the queue finishes pulling the latest merged PRs.",
  },
  "activity-sync-completed": {
    label: "Activity sync finished",
    detail:
      "Your shipped-work totals were refreshed. If the dashboard still looks empty, this time window may not contain merged PRs.",
  },
  connected: {
    label: "GitHub is connected",
  },
  "installation-connected": {
    label: "Repository access granted",
    detail:
      "Your repo scope is live now. Run a sync to turn that access into actual numbers.",
  },
  "invalid-installation": {
    label: "That installation could not be resolved",
  },
  "invalid-state": {
    label: "GitHub lost the auth handshake",
    detail:
      "GitHub returned without a valid auth state. Restart the connect flow in the same tab.",
  },
  "missing-code": {
    label: "GitHub came back without an auth code",
  },
  "missing-config": {
    label: "GitHub is not configured here",
  },
  "not-connected": {
    label: "GitHub is not connected",
  },
  "oauth-account-failed": {
    label: "GitHub connected, but account setup failed",
    detail:
      "GitHub connected, but the app could not finish saving your account details. If it keeps happening, reset the session and try again.",
  },
  "oauth-installations-failed": {
    label: "GitHub connected, but repo access could not be loaded",
    detail:
      "GitHub sign-in worked, but the installation scope could not be read yet.",
  },
  "oauth-session-failed": {
    label: "GitHub connected, but the session could not be stored",
    detail:
      "GitHub connected, but the app could not finish sign-in. Try again.",
  },
  "oauth-token-failed": {
    label: "GitHub token exchange failed",
    detail: "GitHub sign-in did not finish cleanly. Try again.",
  },
  "oauth-user-failed": {
    label: "GitHub authenticated, but user lookup failed",
    detail: "GitHub accepted the app, but user profile lookup did not complete.",
  },
  "repositories-refreshed": {
    label: "Repository scope refreshed",
  },
  "repository-scope-saved": {
    label: "Tracked repositories updated",
    detail:
      "Only the selected repositories will be included in future activity sync runs for that installation.",
  },
  "recommended-repositories-applied": {
    label: "Recommended repositories applied",
    detail:
      "Tracked repositories now match the current recommended 25 based on your recent merged PR activity.",
  },
  "repository-scope-too-large": {
    label: "Too many tracked repositories selected",
    detail:
      "Each installation is capped to 25 tracked repositories to keep sync fanout predictable.",
  },
  "session-reset": {
    label: "Session reset",
    detail: "The saved session was cleared. Connect GitHub again to start fresh.",
  },
  "sync-failed": {
    label: "Sync failed",
    detail: "The app could not pull your latest activity. Try again.",
  },
};

const CONNECT_STEPS = [
  {
    title: "Connect GitHub",
    detail: "Sign in once so the product knows which merged pull requests are yours.",
  },
  {
    title: "Choose the repo scope",
    detail: "Install the GitHub App on the user or organization you want counted.",
  },
  {
    title: "Pull the first snapshot",
    detail: "Sync merged PR activity so the dashboard can show real numbers.",
  },
];

const TRUST_ITEMS = [
  {
    title: "Measures shipped work, not your source code",
    detail:
      "The sync reads repository scope and merged PR stats. It does not pull repository files into the app.",
  },
  {
    title: "Keeps only what the product needs",
    detail:
      "GitHub tokens stay encrypted, and the database stores lightweight activity data instead of a bunch of repo context.",
  },
  {
    title: "Shows the access model before the click",
    detail:
      "You can read the privacy page before connecting GitHub instead of guessing what the product can access.",
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
      prefetch={getLinkPrefetch(href)}
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
  const values = timeline
    .flatMap((point) => [point.additions, point.deletions])
    .filter((value) => value > 0)
    .sort((left, right) => right - left);
  const primaryValue = values[0] ?? maxValue;
  const secondaryValue = values[1] ?? primaryValue;
  const hasScaleBreak = secondaryValue > 0 && primaryValue >= secondaryValue * 1.75;
  const displayMaxValue = hasScaleBreak
    ? Math.max(1, roundTick(secondaryValue * 1.25))
    : roundTick(primaryValue);
  const groupWidth = innerWidth / Math.max(timeline.length, 1);
  const barWidth = Math.min(22, Math.max(10, groupWidth * 0.28));
  const barGap = Math.max(4, groupWidth * 0.08);
  const baselineY = CHART_PADDING.top + innerHeight;

  const toHeight = (value: number) => {
    if (value <= 0) {
      return 0;
    }

    return Math.max(6, (Math.min(value, displayMaxValue) / displayMaxValue) * innerHeight);
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
        truncated: point.additions > displayMaxValue,
      },
      deletions: {
        x: centerX + barGap / 2,
        y: baselineY - deletionsHeight,
        height: deletionsHeight,
        truncated: point.deletions > displayMaxValue,
      },
    };
  });

  return {
    ticks: getTickValues(displayMaxValue),
    maxAdditions: Math.max(...timeline.map((point) => point.additions), 0),
    maxDeletions: Math.max(...timeline.map((point) => point.deletions), 0),
    bars,
    baselineY,
    barWidth,
    maxValue,
    displayMaxValue,
    hasScaleBreak,
    innerHeight,
  };
}

function getTypicalWeekValue(timeline: TimelinePoint[]) {
  const totals = timeline
    .map((point) => point.additions + point.deletions)
    .filter((value) => value > 0)
    .sort((left, right) => left - right);

  if (totals.length === 0) {
    return 0;
  }

  return totals[Math.floor(totals.length / 2)] ?? 0;
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

type RepoSummary = {
  name: string;
  detail: string;
  visibility: string;
  additions: number;
  deletions: number;
  commitCount: number;
};

type DashboardPayload = {
  user: string;
  view: AnalyticsView;
  mode: MetricMode;
  filters: string[];
  summary: Array<{ label: string; value: string; detail: string }>;
  timeline: TimelinePoint[];
  repositories: RepoSummary[];
  chartTitle: string;
  activitySyncRunning: boolean;
  syncHealth: SyncHealthSummary | null;
  profile: {
    login: string;
    source: "live" | "sample";
  };
};

type PeakWeekSummary = {
  label: string;
  total: number;
  additions: number;
  deletions: number;
};

function RepoSection({
  repositories,
  repoActivityMax,
  installations,
  connected,
  hasInstallations,
  accessibleRepositoryCount,
  trackedRepositoryCount,
}: {
  repositories: RepoSummary[];
  repoActivityMax: number;
  installations: GithubStateInstallation[];
  connected: boolean;
  hasInstallations: boolean;
  accessibleRepositoryCount: number;
  trackedRepositoryCount: number;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_360px]">
      <section className="story-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="panel-label">Repository activity</p>
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
                Install the GitHub App, then run a sync to populate repository metrics.
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
            ? `${formatNumber(trackedRepositoryCount)} of ${formatNumber(accessibleRepositoryCount)} repositories are currently tracked.`
            : "Install the GitHub App on the account you want to measure to unlock repository-level metrics."}
        </p>

        {hasInstallations ? (
          <div className="scope-list">
            {installations.map((installation, index) => (
              <article key={installation.id} className="scope-item">
                {(() => {
                  const trackedIds = installation.repositories
                    .filter((repository) => repository.syncEnabled)
                    .map((repository) => repository.id)
                    .sort();
                  const recommendedIds = [...installation.recommendedRepositoryIds].sort();
                  const recommendationDiffers =
                    trackedIds.length !== recommendedIds.length ||
                    trackedIds.some((repositoryId, index) => repositoryId !== recommendedIds[index]);
                  const recommendedNames = installation.repositories
                    .filter((repository) =>
                      installation.recommendedRepositoryIds.includes(repository.id),
                    )
                    .map((repository) => `${repository.owner}/${repository.name}`);

                  return (
                    <>
                <div className="scope-item-head">
                  <div>
                    <p className="scope-item-title">
                      {installations.length === 1 ? "Primary scope" : installation.accountLogin}
                    </p>
                    <p className="scope-item-meta">
                      {installation.trackedRepositoryCount}/{installation.repositoryCount} tracked repos
                    </p>
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
                  {installation.repositories.filter((repository) => repository.syncEnabled).length > 0
                    ? installation.repositories
                        .filter((repository) => repository.syncEnabled)
                        .slice(0, 3)
                        .map((repository) => `${repository.owner}/${repository.name}`)
                        .join(", ")
                    : index === 0
                      ? "No repositories are tracked yet for this scope."
                      : "No tracked repositories yet for this scope."}
                </p>
                <div className="mt-4 rounded-[1.25rem] border border-line/80 bg-white/60 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Recommended scope
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {installation.recommendedRepositoryCount > 0
                      ? `${installation.recommendedRepositoryCount} repos based on your recent merged PR activity, with repo recency as fallback.`
                      : "No recommendation yet. Run a sync first so the app can rank your most active repositories."}
                  </p>
                  {recommendedNames.length > 0 ? (
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {recommendedNames.slice(0, 3).join(", ")}
                      {recommendedNames.length > 3 ? "…" : ""}
                    </p>
                  ) : null}
                  {recommendationDiffers ? (
                    <form
                      action={`/api/github/installations/${installation.githubInstallId}/scope/recommended`}
                      method="post"
                      className="mt-4"
                    >
                      <button type="submit" className="button-secondary button-compact">
                        Use recommended 25
                      </button>
                    </form>
                  ) : (
                    <p className="mt-3 text-sm font-medium text-foreground">
                      Current tracked scope already matches the recommendation.
                    </p>
                  )}
                </div>
                <details className="mt-4 rounded-[1.25rem] border border-line/80 bg-white/60 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    Choose tracked repositories
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    Up to 25 repositories per installation will be included in queued activity sync.
                  </p>
                  <form
                    action={`/api/github/installations/${installation.githubInstallId}/scope`}
                    method="post"
                    className="mt-4 space-y-4"
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {installation.repositories.map((repository) => (
                        <label
                          key={repository.id}
                          className="flex items-center gap-3 rounded-[1rem] border border-line/80 bg-white/70 px-3 py-2 text-sm text-foreground"
                        >
                          <input
                            type="checkbox"
                            name="repositoryIds"
                            value={repository.id}
                            defaultChecked={repository.syncEnabled}
                            className="h-4 w-4"
                          />
                          <span>{repository.owner}/{repository.name}</span>
                        </label>
                      ))}
                    </div>
                    <button type="submit" className="button-secondary button-compact">
                      Save tracked repos
                    </button>
                  </form>
                </details>
                    </>
                  );
                })()}
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
          <p className="panel-label">Privacy</p>
          <h3 className="panel-heading">What the app reads and what it does not</h3>
          <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
            If a product asks for GitHub access, the data model should be clear before you connect it.
          </p>
        </div>

        <Link href="/privacy" className="button-secondary w-full sm:w-auto">
          Read privacy page
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
  description: "We could not load your GitHub connection state. Please try again.",
  primaryAction: { label: "Reconnect GitHub", href: "/api/github/connect" },
  accountId: null as string | null,
  viewer: null,
  activitySync: null,
  activitySyncRunning: false,
  syncHealth: null as SyncHealthSummary | null,
  installations: [] as Array<{
    id: string;
    githubInstallId: number;
    accountLogin: string;
    repositoryCount: number;
    trackedRepositoryCount: number;
    recommendedRepositoryCount: number;
    recommendedRepositoryIds: string[];
    repositories: Array<{
      id: string;
      name: string;
      owner: string;
      syncEnabled: boolean;
    }>;
  }>,
} satisfies GithubState;

export default async function Home({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  const view =
    typeof params.view === "string" &&
    ["daily", "weekly", "monthly"].includes(params.view)
      ? (params.view as AnalyticsView)
      : "daily";
  const mode: MetricMode = "shipped";
  const githubStatus = typeof params.github === "string" ? params.github : undefined;

  let githubState: GithubState = FALLBACK_GITHUB_STATE;
  let dashboard: DashboardPayload | null = null;
  try {
    githubState =
      normalizeGithubState(
        hasCloudflareWorkerProxy()
          ? await fetchCloudflareReadJson<GithubState>("/api/github/state")
          : null,
      ) ?? FALLBACK_GITHUB_STATE;
    dashboard = githubState.connected
      ? await fetchCloudflareReadJson<DashboardPayload>(
          `/api/metrics?${new URLSearchParams({
            view,
            mode,
          }).toString()}`,
        )
      : null;
  } catch {
    githubState = FALLBACK_GITHUB_STATE;
    dashboard = null;
  }
  const githubStatusCopy = githubStatus
    ? GITHUB_STATUS_COPY[githubStatus] ?? { label: githubStatus }
    : null;
  const views: AnalyticsView[] = ["daily", "weekly", "monthly"];
  const hasInstallations = githubState.installations.length > 0;
  const repoActivityMax = Math.max(
    1,
    ...(dashboard?.repositories.map(
      (repository) => repository.additions + repository.deletions,
    ) ?? [1]),
  );
  const chartGeometry = dashboard ? buildBarChartGeometry(dashboard.timeline) : null;
  const peakWeek = dashboard?.timeline.reduce<PeakWeekSummary | null>((currentPeak, point) => {
    const total = point.additions + point.deletions;

    if (!currentPeak || total > currentPeak.total) {
      return {
        label: point.label,
        total,
        additions: point.additions,
        deletions: point.deletions,
      };
    }

    return currentPeak;
  }, null) ?? null;
  const typicalWeekValue = dashboard ? getTypicalWeekValue(dashboard.timeline) : 0;
  const connectionSummary = githubState.activitySyncRunning
    ? "Running now"
    : githubState.activitySync
      ? `${githubState.activitySync.status} · ${githubState.activitySync.updatedAt}`
      : "Ready to sync";
  const accessibleRepositoryCount = githubState.installations.reduce(
    (count, installation) => count + installation.repositoryCount,
    0,
  );
  const trackedRepositoryCount = githubState.installations.reduce(
    (count, installation) => count + installation.trackedRepositoryCount,
    0,
  );
  const syncQueueSummary = githubState.syncHealth
    ? githubState.syncHealth.runningJobs > 0
      ? `${githubState.syncHealth.runningJobs} running`
      : githubState.syncHealth.queuedJobs > 0
        ? `${githubState.syncHealth.queuedJobs} queued`
        : "Idle"
    : "Idle";
  const compactFilters = dashboard
    ? [
        dashboard.filters[0],
        "Shipped work",
        dashboard.filters.at(-1),
      ].filter(Boolean)
    : [];

  return (
    <main className="page-shell min-h-screen">
      <div className="page-wash" />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <section className="top-panel">
          <div className="top-panel-copy">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                Vibe Tracker
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <Link href="/" className="toggle-pill toggle-pill-active">
                  Dashboard
                </Link>
                <Link href="/social" className="toggle-pill">
                  Social
                </Link>
                <ThemeToggle />
              </div>
            </div>
            <div className="space-y-4">
              <h1 className="page-title">How much are you actually shipping?</h1>
              <p className="page-description">
                Track shipped work, recent momentum, and repository impact from your merged pull requests.
              </p>
            </div>
          </div>

          <div className="top-panel-meta">
            <div className="meta-stack">
              <div className="meta-row">
                <span className="hero-meta-label">GitHub</span>
                <span className="hero-meta-value">
                  {githubState.connected ? "GitHub connected" : "Not connected"}
                </span>
              </div>
              <div className="meta-row">
                <span className="hero-meta-label">Last pull</span>
                <span className="hero-meta-value">{connectionSummary}</span>
              </div>
              <div className="meta-row">
                <span className="hero-meta-label">Repos in scope</span>
                <span className="hero-meta-value">
                  {formatNumber(trackedRepositoryCount)}
                </span>
              </div>
              <div className="meta-row">
                <span className="hero-meta-label">Accessible repos</span>
                <span className="hero-meta-value">
                  {formatNumber(accessibleRepositoryCount)}
                </span>
              </div>
              <div className="meta-row">
                <span className="hero-meta-label">Sync queue</span>
                <span className="hero-meta-value">
                  {syncQueueSummary}
                </span>
              </div>
            </div>

            <p className="hero-note">
              Repository access stays scoped to sync data. You can refresh merged PR activity without pulling source code into the app.
            </p>

            <div className="hero-actions">
              <ConnectionAction href="/privacy" label="Read privacy page" tone="secondary" />
              {!githubState.connected && githubState.primaryAction ? (
                <>
                  <ConnectionAction
                    href={githubState.primaryAction.href}
                    label={githubState.primaryAction.label === "Connect GitHub" ? "Start with GitHub" : githubState.primaryAction.label}
                  />
                  <ConnectionAction
                    href="/api/session/reset"
                    label="Reset session"
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
                    {githubState.activitySyncRunning ? "Syncing..." : "Refresh activity"}
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
                        ? "These numbers come from synced merged PR stats and daily shipped-work aggregates stored locally."
                        : "This is sample data that mirrors the live view once GitHub activity has been synced."}
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
                <div className="space-y-3">
                  <p className="panel-label">{dashboard.chartTitle}</p>
                  <h3 className="panel-heading">Lines changed by ship period</h3>
                  <p className="chart-intro">
                    Additions and deletions share one upward scale so the busiest periods stay easy to compare at a glance.
                    {chartGeometry?.hasScaleBreak
                      ? ` The scale is capped at ${formatNumber(chartGeometry.displayMaxValue)} lines to keep non-peak periods readable.`
                      : " The vertical scale stays linear across the full selected range."}
                  </p>
                </div>
                <div className="chart-legend" aria-label="Chart legend">
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
                      <p className="panel-label">Peak period</p>
                      <p className="chart-stat-value">
                        {peakWeek?.label ?? "N/A"}
                      </p>
                      <p className="chart-stat-detail">
                        {peakWeek
                          ? `+${formatNumber(peakWeek.additions)} added and -${formatNumber(peakWeek.deletions)} removed`
                          : "No shipped work in this range yet."}
                      </p>
                    </article>
                    <article className="chart-stat-card">
                      <p className="panel-label">Typical active period</p>
                      <p className="chart-stat-value">
                        {formatNumber(typicalWeekValue)}
                      </p>
                      <p className="chart-stat-detail">Median combined line change for non-zero periods in this view.</p>
                    </article>
                    <article className="chart-stat-card">
                      <p className="panel-label">Visible chart ceiling</p>
                      <p className="chart-stat-value">
                        {formatNumber(chartGeometry.displayMaxValue)}
                      </p>
                      <p className="chart-stat-detail">
                        {chartGeometry.hasScaleBreak
                          ? "Overflow caps mark periods that exceeded the visible scale."
                          : "No scale break applied in this range."}
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
              trackedRepositoryCount={trackedRepositoryCount}
            />
          </>
        ) : (
          <section id="dashboard" className="dashboard-shell">
            <div className="empty-shell">
              <div className="space-y-4">
                <span className="eyebrow eyebrow-subtle">Not connected</span>
                <h2 className="dashboard-title max-w-3xl">
                  Connect GitHub to get started.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                  This dashboard only shows synced GitHub activity. Until the account is connected and the first sync finishes, there is nothing to show here yet.
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
                    <ConnectionAction href="/privacy" label="Read privacy page" tone="secondary" />
                    <ConnectionAction
                      href={githubState.primaryAction.href}
                      label={githubState.primaryAction.label === "Connect GitHub" ? "Start with GitHub" : githubState.primaryAction.label}
                    />
                    <ConnectionAction
                      href="/api/session/reset"
                      label="Reset session"
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
