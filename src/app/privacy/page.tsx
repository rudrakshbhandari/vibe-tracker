import Link from "next/link";
import { ArrowRight, Github, LockKeyhole, ShieldCheck } from "lucide-react";

const ACCESS_POINTS = [
  {
    title: "What Vibe Tracker reads",
    body:
      "GitHub identity, installation scope, repository names, repository visibility, and the merged PR stats needed to measure shipped work.",
  },
  {
    title: "What Vibe Tracker stores",
    body:
      "Encrypted GitHub session tokens, connected repo scope, merged PR counters, and daily aggregates that power the dashboard and social surfaces.",
  },
  {
    title: "What Vibe Tracker does not touch",
    body:
      "It does not clone repositories, read source files, or ingest repo contents just to compute your numbers.",
  },
];

const LAUNCH_GUARDS = [
  "GitHub tokens are encrypted server-side before they are written to the database.",
  "The sync stays limited to merged pull request activity instead of crawling your full branch graph.",
  "The GitHub App only asks for repository metadata and pull-request read access.",
];

export default function PrivacyPage() {
  return (
    <main className="page-shell min-h-screen">
      <div className="page-wash" />
      <div className="relative mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <section className="top-panel">
          <div className="top-panel-copy">
            <span className="eyebrow">Privacy</span>
            <div className="space-y-3">
              <h1 className="page-title">If you connect GitHub, this is the deal.</h1>
              <p className="page-description">
                This copy is intentionally plain. If the app wants access, you should know exactly what it reads, stores, and leaves alone.
              </p>
            </div>
            <div className="hero-actions">
              <Link href="/" className="button-primary w-full sm:w-auto">
                Back to dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="top-panel-meta">
            <div className="meta-stack">
              <div className="meta-row">
                <span className="hero-meta-label">Code access</span>
                <span className="hero-meta-value">No source-file ingestion</span>
              </div>
              <div className="meta-row">
                <span className="hero-meta-label">Token handling</span>
                <span className="hero-meta-value">Encrypted at rest</span>
              </div>
              <div className="meta-row">
                <span className="hero-meta-label">Metric source</span>
                <span className="hero-meta-value">Merged PR stats only</span>
              </div>
            </div>

            <p className="hero-note">
              If this product ever needs deeper repository analysis, that should ship with a new permission review and updated disclosure. No quiet scope creep.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {ACCESS_POINTS.map((item) => (
            <article key={item.title} className="onboarding-card">
              <p className="panel-label">Plain English</p>
              <h2 className="mt-3 text-2xl font-semibold text-foreground">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <article className="story-panel">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-[var(--success)]" />
              <div>
                <p className="panel-label">Current guardrails</p>
                <h2 className="panel-heading">Why the current model is launch-safe</h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {LAUNCH_GUARDS.map((guard) => (
                <div key={guard} className="trust-item">
                  <span className="trust-dot" />
                  <p className="text-sm leading-6 text-muted">{guard}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="sidebar-panel">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-1 h-5 w-5 text-[var(--accent-strong)]" />
              <div>
                <p className="panel-label">Permission scope</p>
                <h2 className="panel-heading">GitHub access, in plain terms</h2>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm leading-6 text-muted">
              <p>
                <strong className="text-foreground">Requested:</strong> repository metadata
                read-only and pull requests read-only.
              </p>
              <p>
                <strong className="text-foreground">Not requested:</strong> source code contents
                permission.
              </p>
              <p>
                Users should be able to compare their shipped work without handing over repo code.
              </p>
            </div>

            <div className="mt-5 rounded-[1.4rem] border border-line bg-white/72 p-4">
              <div className="flex items-start gap-3">
                <Github className="mt-0.5 h-4 w-4 text-muted" />
                <p className="text-sm leading-6 text-muted">
                  Questions about data handling should land here before the connect flow, not after someone already installed the app.
                </p>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
