import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Github,
  LineChart,
  RefreshCcw,
} from "lucide-react";

import { formatNumber, getDashboardData } from "@/lib/dashboard";
import type { AnalyticsView, MetricMode } from "@/lib/dashboard";
import { getGithubConnectionState } from "@/lib/github-state";
import { getLiveMetrics } from "@/lib/live-metrics";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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
  const dashboard = (await getLiveMetrics(view, mode)) ?? getDashboardData();
  const githubState = await getGithubConnectionState();
  const githubStatus =
    typeof params.github === "string" ? params.github : undefined;
  const views: AnalyticsView[] = ["daily", "weekly", "monthly"];
  const modes: MetricMode[] = ["authored", "merged"];

  return (
    <main className="grid-lines min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="rounded-[2rem] border border-line bg-panel px-6 py-5 shadow-[0_24px_80px_rgba(72,56,31,0.08)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center gap-3 text-sm font-medium uppercase tracking-[0.24em] text-muted">
                <span className="rounded-full border border-line px-3 py-1">
                  Vibe Tracker
                </span>
                <span>GitHub code volume, without branch inflation</span>
              </div>
              <div className="space-y-3">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
                  Understand what a user actually changed across repos, branches,
                  and pull requests.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
                  The MVP uses authored commits as the source of truth, dedupes by
                  commit SHA, and lets you toggle between all authored work and
                  what reached the default branch.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="#dashboard" className="button-primary">
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/api/metrics?view=${view}&mode=${mode}`}
                className="button-secondary"
              >
                View metrics JSON
                <LineChart className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        {githubStatus ? (
          <section className="rounded-[1.5rem] border border-line bg-panel px-5 py-4 text-sm text-muted shadow-[0_16px_50px_rgba(72,56,31,0.06)]">
            GitHub flow status:{" "}
            <span className="font-semibold text-foreground">{githubStatus}</span>
          </section>
        ) : null}

        <section id="dashboard" className="grid gap-6 xl:grid-cols-12">
          <div className="rounded-[2rem] border border-line bg-panel p-6 shadow-[0_24px_80px_rgba(72,56,31,0.08)] backdrop-blur xl:col-span-8">
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
                      className={
                        entry === view
                          ? "rounded-full bg-foreground px-3 py-1.5 font-medium text-[#fffaf0]"
                          : "rounded-full border border-line px-3 py-1.5 font-medium text-muted"
                      }
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
                      className={
                        entry === mode
                          ? "rounded-full bg-[#13222d] px-3 py-1.5 font-medium text-[#f6efe4]"
                          : "rounded-full border border-line px-3 py-1.5 font-medium text-muted"
                      }
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
                  className="rounded-[1.5rem] border border-line bg-panel-strong p-4"
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
              <section className="rounded-[1.5rem] border border-line bg-[#13222d] p-5 text-[#f6efe4]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[#b3c8d6]">
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
                        <p className="text-xs text-[#b3c8d6]">{point.label}</p>
                        <p className="font-mono text-xs text-white/88">
                          +{formatNumber(point.additions)} / -
                          {formatNumber(point.deletions)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-line bg-panel-strong p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">
                  Repository breakdown
                </p>
                <div className="mt-4 space-y-4">
                  {dashboard.repositories.map((repo) => (
                    <article
                      key={repo.name}
                      className="rounded-[1.25rem] border border-line px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">{repo.name}</h3>
                          <p className="mt-1 text-sm text-muted">{repo.detail}</p>
                        </div>
                        <span className="rounded-full bg-[#efe4cf] px-3 py-1 text-xs font-medium text-[#6f553b]">
                          {repo.visibility}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center gap-3 text-sm text-muted">
                        <span>+{formatNumber(repo.additions)}</span>
                        <span>-{formatNumber(repo.deletions)}</span>
                        <span>{repo.commitCount} commits</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <aside className="flex flex-col gap-6 xl:col-span-4">
            <section className="rounded-[2rem] border border-line bg-panel p-6 shadow-[0_24px_80px_rgba(72,56,31,0.08)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-muted">
                    GitHub connection
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
                    <button type="submit" className="button-secondary w-full">
                      Sync my activity
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

            <section className="rounded-[2rem] border border-line bg-[#fffaf0] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-muted">
                    Installations
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                    {githubState.installations.length} connected scopes
                  </h2>
                </div>
                <RefreshCcw className="h-5 w-5 text-muted" />
              </div>

              <div className="mt-5 space-y-4">
                {githubState.installations.length > 0 ? (
                  githubState.installations.map((installation) => (
                    <article
                      key={installation.id}
                      className="rounded-[1.25rem] border border-line bg-panel p-4"
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
                      <p className="mt-3 text-sm leading-6 text-muted">
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
                  <p className="text-sm leading-6 text-muted">
                    Once the app is installed on a user or organization, it will
                    appear here and can be synced into the local cache.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-line bg-[#13222d] p-6 text-[#f6efe4]">
              <div className="flex items-center gap-3">
                <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-[#b3c8d6]">
                  API sample
                </div>
              </div>
              <h2 className="mt-4 text-lg font-semibold">Why the model scales</h2>
              <p className="mt-3 text-sm leading-6 text-[#b3c8d6]">
                Repositories, branches, and pull requests are just attribution
                layers around one canonical commit record. That keeps the API
                honest as repo count grows.
              </p>
              <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/6 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#b3c8d6]">
                  Core rule
                </p>
                <p className="mt-3 font-mono text-sm text-white/90">
                  one commit SHA
                  <br />
                  = one unit of work
                  <br />
                  regardless of branch count
                </p>
              </div>
            </section>
          </aside>

          <section className="rounded-[2rem] border border-line bg-panel p-6 shadow-[0_24px_80px_rgba(72,56,31,0.08)] backdrop-blur xl:col-span-5">
            <p className="text-sm uppercase tracking-[0.24em] text-muted">
              Locked decisions
            </p>
            <div className="mt-5 grid gap-4">
              {dashboard.decisions.map((decision) => (
                <article
                  key={decision.title}
                  className="rounded-[1.25rem] border border-line bg-panel-strong p-4"
                >
                  <h3 className="font-semibold">{decision.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {decision.value}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-line bg-[#fffaf0] p-6 xl:col-span-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-muted">
                  Sync pipeline
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                  How data lands in the dashboard
                </h2>
              </div>
              <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">
                Background jobs
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.pipeline.map((step) => (
                <div
                  key={step.title}
                  className="rounded-[1.25rem] border border-line bg-panel p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-10 w-10 rounded-full border border-line bg-panel-strong p-2">
                      <step.icon className="h-full w-full" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
