import Link from "next/link";
import { ArrowRight, Github, LineChart } from "lucide-react";

import { formatNumber, getDashboardData } from "@/lib/dashboard";

export default function Home() {
  const dashboard = getDashboardData();

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
              <Link
                href="#dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
              >
                Explore MVP
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/api/metrics?window=30d&mode=authored"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-panel-strong px-5 py-3 text-sm font-medium"
              >
                View API sample
                <LineChart className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <section
          id="dashboard"
          className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]"
        >
          <div className="rounded-[2rem] border border-line bg-panel p-6 shadow-[0_24px_80px_rgba(72,56,31,0.08)] backdrop-blur">
            <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-muted">
                  Sample dashboard
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                  {dashboard.profile.login}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                  Local demo data that mirrors the model we will populate from the
                  GitHub API during sync jobs.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
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
                      Activity by week
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
                          +{formatNumber(point.additions)} / -{formatNumber(point.deletions)}
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

          <aside className="flex flex-col gap-6">
            <section className="rounded-[2rem] border border-line bg-panel p-6 shadow-[0_24px_80px_rgba(72,56,31,0.08)] backdrop-blur">
              <p className="text-sm uppercase tracking-[0.24em] text-muted">
                Locked decisions
              </p>
              <div className="mt-5 space-y-4">
                {dashboard.decisions.map((decision) => (
                  <article key={decision.title} className="space-y-1">
                    <h3 className="font-semibold">{decision.title}</h3>
                    <p className="text-sm leading-6 text-muted">{decision.value}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-line bg-[#fffaf0] p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-muted">
                Sync pipeline
              </p>
              <div className="mt-5 space-y-4">
                {dashboard.pipeline.map((step) => (
                  <div key={step.title} className="flex gap-3">
                    <div className="mt-1 h-10 w-10 rounded-full border border-line bg-panel-strong p-2">
                      <step.icon className="h-full w-full" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-sm leading-6 text-muted">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-line bg-[#13222d] p-6 text-[#f6efe4]">
              <div className="flex items-center gap-3">
                <Github className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Next integration step</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#b3c8d6]">
                Wire GitHub App installation, store repository grants, and enqueue
                sync jobs per installation.
              </p>
              <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/6 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#b3c8d6]">
                  Planned env
                </p>
                <p className="mt-3 font-mono text-sm text-white/90">
                  DATABASE_URL
                  <br />
                  GITHUB_APP_ID
                  <br />
                  GITHUB_APP_PRIVATE_KEY
                  <br />
                  GITHUB_WEBHOOK_SECRET
                </p>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
