import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Github,
  Lock,
  Share2,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from "lucide-react";

import { ActivitySyncRefresh } from "@/components/activity-sync-refresh";
import { formatNumber } from "@/lib/dashboard";
import { getGithubConnectionState } from "@/lib/github-state";
import { getLiveMetrics } from "@/lib/live-metrics";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const GITHUB_STATUS_COPY: Record<string, { label: string; detail?: string }> = {
  "activity-sync-started": {
    label: "Wrapped sync started",
    detail:
      "Your GitHub activity is being refreshed now. Come back in a moment for updated stats.",
  },
  "activity-sync-running": {
    label: "Wrapped sync already running",
    detail: "A refresh is already in progress. No extra clicks needed.",
  },
  "activity-sync-completed": {
    label: "Wrapped refreshed",
    detail: "Your shipped-work snapshot was refreshed successfully.",
  },
  connected: {
    label: "GitHub connected",
    detail: "Your account is ready. Install the app or run a sync to generate live wrapped stats.",
  },
  "installation-connected": {
    label: "Installation connected",
    detail: "Repository access is ready. Run a sync to turn that activity into your wrapped.",
  },
  "invalid-installation": {
    label: "Installation could not be resolved",
  },
  "invalid-state": {
    label: "GitHub auth state mismatch",
    detail: "The GitHub login flow came back without a valid auth state. Restart the flow in the same tab.",
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
  },
  "oauth-installations-failed": {
    label: "GitHub connected, but installations could not be loaded",
  },
  "oauth-session-failed": {
    label: "GitHub connected, but the session could not be stored",
  },
  "oauth-token-failed": {
    label: "GitHub token exchange failed",
  },
  "oauth-user-failed": {
    label: "GitHub token worked, but user lookup failed",
  },
  "repositories-refreshed": {
    label: "Repositories refreshed",
  },
  "session-reset": {
    label: "Session reset",
    detail: "The previous sign-in session was cleared.",
  },
  "sync-failed": {
    label: "Sync failed",
    detail: "The app could not complete the current refresh.",
  },
};

const TRUST_POINTS = [
  "No source code access",
  "Private by default",
  "Share only what you want",
];

const WRAPPED_CARDS = [
  {
    kicker: "Builder archetype",
    title: "The Finisher",
    body: "You do not just start things. You turn open work into landed work.",
  },
  {
    kicker: "Main character month",
    title: "September",
    body: "Your shipping energy peaked when the rest of the year started to feel routine.",
  },
  {
    kicker: "Signature",
    title: "Consistency > Chaos",
    body: "You build in rhythm, not panic. Your best work compounds instead of exploding.",
  },
];

const STORY_STEPS = [
  {
    title: "Connect GitHub",
    body: "Sign in once and choose the repositories or orgs you want included in your recap.",
  },
  {
    title: "Generate your wrapped",
    body: "We turn PR timing, merge activity, and repository metadata into a personal story.",
  },
  {
    title: "Post the parts you love",
    body: "Share your archetype, streaks, and highlight cards without exposing your code.",
  },
];

const SIGNALS = [
  "Builder archetype",
  "Peak month",
  "Shipping streaks",
  "Late-night energy",
  "PR style",
  "Repo spread",
];

const FAQS = [
  {
    question: "Does Vibe Tracker read my code?",
    answer:
      "No. Vibe Tracker uses repository metadata and pull request stats. It does not read file contents or clone repositories.",
  },
  {
    question: "Can I keep my wrapped private?",
    answer:
      "Yes. Profiles and recaps stay private by default, and sharing is always opt-in.",
  },
  {
    question: "Why would I post this?",
    answer:
      "Because it feels like a personal internet artifact, not a dashboard. The goal is identity and fun, not performance reporting.",
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

export default async function Home({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  const githubStatus = typeof params.github === "string" ? params.github : undefined;

  let githubState;
  let liveMetrics: Awaited<ReturnType<typeof getLiveMetrics>> = null;
  try {
    githubState = await getGithubConnectionState();
    liveMetrics = githubState.connected ? await getLiveMetrics("weekly", "shipped") : null;
  } catch {
    githubState = {
      connected: false,
      title: "GitHub sync unavailable",
      description: "We could not load your connection state right now. Try again shortly.",
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
  }

  const githubStatusCopy = githubStatus
    ? GITHUB_STATUS_COPY[githubStatus] ?? { label: githubStatus }
    : null;
  const repoCount = githubState.installations.reduce(
    (count, installation) => count + installation.repositoryCount,
    0,
  );
  const syncLabel = githubState.activitySyncRunning
    ? "Sync running now"
    : githubState.activitySync
      ? `${githubState.activitySync.status} · ${githubState.activitySync.updatedAt}`
      : "No sync yet";
  const summaryHighlights = liveMetrics?.summary.slice(0, 3) ?? [
    { label: "Builder archetype", value: "The Finisher", detail: "Turns open work into landed work." },
    { label: "Peak month", value: "September", detail: "Main character energy." },
    { label: "Signature", value: "Consistency > Chaos", detail: "Steady shipping wins." },
  ];
  const syncRefreshActive =
    githubState.activitySyncRunning ||
    githubStatus === "activity-sync-started" ||
    githubStatus === "activity-sync-running";

  return (
    <main className="page-shell landing-shell min-h-screen">
      <ActivitySyncRefresh active={syncRefreshActive} />
      <div className="page-wash" />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <header className="landing-nav">
          <Link href="/" className="landing-brand">
            <span className="landing-brand-mark">VT</span>
            <span>Vibe Tracker</span>
          </Link>

          <nav className="landing-nav-links">
            <Link href="#story">Story</Link>
            <Link href="#privacy">Privacy</Link>
            <Link href="/social">Social</Link>
          </nav>

          <div className="landing-nav-actions">
            {githubState.connected ? (
              <span className="landing-nav-chip">
                <CheckCircle2 className="h-4 w-4" />
                @{githubState.viewer?.login ?? "connected"}
              </span>
            ) : null}
            <ConnectionAction
              href={githubState.connected ? "/api/github/install" : "/api/github/connect"}
              label={githubState.connected ? "Add GitHub Scope" : "Get My Wrapped"}
            />
          </div>
        </header>

        {githubStatus ? (
          <section className={`landing-status-note ${getStatusTone(githubStatus)}`}>
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

        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="eyebrow landing-pill">
              <Sparkles className="h-3.5 w-3.5" />
              Spotify Wrapped for developers
            </span>
            <h1 className="landing-title">Your year in code, turned into something worth posting.</h1>
            <p className="landing-description">
              Vibe Tracker turns GitHub pull request activity into a cinematic developer recap:
              your builder archetype, your peak month, your streaks, your late-night eras, and
              the signature pattern behind how you ship.
            </p>

            <div className="landing-trust-row">
              {TRUST_POINTS.map((point) => (
                <span key={point} className="landing-trust-chip">
                  {point}
                </span>
              ))}
            </div>

            <div className="hero-actions">
              {!githubState.connected && githubState.primaryAction ? (
                <>
                  <ConnectionAction href={githubState.primaryAction.href} label="Get My Wrapped" />
                  <ConnectionAction href="#privacy" label="Why It Feels Safe" tone="secondary" />
                </>
              ) : null}

              {githubState.connected && githubState.installations.length === 0 ? (
                <>
                  <ConnectionAction href="/api/github/install" label="Install GitHub App" />
                  <ConnectionAction href="/social" label="See Social" tone="secondary" />
                </>
              ) : null}

              {githubState.connected && githubState.installations.length > 0 ? (
                <>
                  <form action="/api/github/activity-sync" method="post">
                    <button
                      type="submit"
                      className="button-primary w-full sm:w-auto"
                      disabled={githubState.activitySyncRunning}
                    >
                      {githubState.activitySyncRunning ? "Refreshing Wrapped" : "Generate Live Wrapped"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                  <ConnectionAction href="/social" label="Open Social" tone="secondary" />
                </>
              ) : null}
            </div>

            <div className="landing-proof-grid">
              <article className="landing-proof-card">
                <p className="landing-proof-label">Connected repos</p>
                <p className="landing-proof-value">{formatNumber(repoCount)}</p>
                <p className="landing-proof-copy">
                  The repos you explicitly grant access to are the ones that shape your recap.
                </p>
              </article>
              <article className="landing-proof-card">
                <p className="landing-proof-label">Latest sync</p>
                <p className="landing-proof-value landing-proof-value-compact">{syncLabel}</p>
                <p className="landing-proof-copy">
                  Live wrapped cards update from synced GitHub activity after you refresh.
                </p>
              </article>
              <article className="landing-proof-card">
                <p className="landing-proof-label">Share mode</p>
                <p className="landing-proof-value">Opt-in</p>
                <p className="landing-proof-copy">
                  Keep everything private or post only the cards that feel like you.
                </p>
              </article>
            </div>
          </div>

          <div className="landing-hero-art">
            <article className="wrapped-stage">
              <div className="wrapped-stage-top">
                <span className="wrapped-stage-kicker">Vibe Tracker 2026</span>
                <span className="wrapped-stage-chip">
                  <Lock className="h-3.5 w-3.5" />
                  No code access
                </span>
              </div>

              <div className="wrapped-stage-main">
                <p className="wrapped-stage-label">Builder archetype</p>
                <h2 className="wrapped-stage-title">The Steady Shipper</h2>
                <p className="wrapped-stage-copy">
                  You built in rhythm, not panic. Your work stacked quietly until it became the
                  story.
                </p>
              </div>

              <div className="wrapped-mini-grid">
                {WRAPPED_CARDS.map((card) => (
                  <article key={card.title} className="wrapped-mini-card">
                    <p className="wrapped-mini-kicker">{card.kicker}</p>
                    <h3 className="wrapped-mini-title">{card.title}</h3>
                    <p className="wrapped-mini-copy">{card.body}</p>
                  </article>
                ))}
              </div>

              <div className="wrapped-stage-footer">
                <span>Shareable recap cards</span>
                <span>Built from PR metadata</span>
              </div>
            </article>
          </div>
        </section>

        <section className="landing-band">
          <div className="landing-band-copy">
            <p className="panel-label">Why this works</p>
            <h2 className="landing-section-title">Developers do not want another dashboard. They want an artifact.</h2>
          </div>

          <div className="landing-band-grid">
            <article className="landing-band-card">
              <ShieldCheck className="h-5 w-5" />
              <h3>Trust-first by design</h3>
              <p>No source code access. No repo cloning. Clear permissions. Better conversion.</p>
            </article>
            <article className="landing-band-card">
              <Share2 className="h-5 w-5" />
              <h3>Built to be posted</h3>
              <p>Make every recap card feel like a screenshot someone would actually share.</p>
            </article>
            <article className="landing-band-card">
              <Clock3 className="h-5 w-5" />
              <h3>Identity over output</h3>
              <p>Lead with archetypes, eras, streaks, and style instead of raw line-count flexing.</p>
            </article>
          </div>
        </section>

        <section id="story" className="landing-story-grid">
          <article className="landing-story-panel">
            <p className="panel-label">How it works</p>
            <h2 className="landing-section-title">A recap flow that feels more like a story than setup.</h2>
            <div className="landing-step-list">
              {STORY_STEPS.map((step, index) => (
                <article key={step.title} className="landing-step-card">
                  <span className="landing-step-index">0{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="landing-story-panel landing-story-panel-accent">
            <p className="panel-label">Signals we use</p>
            <h2 className="landing-section-title">Your wrapped should feel specific, not generic.</h2>
            <div className="landing-signal-grid">
              {SIGNALS.map((signal) => (
                <span key={signal} className="landing-signal-chip">
                  {signal}
                </span>
              ))}
            </div>
            <p className="landing-panel-copy">
              We use PR timing, merge activity, repo spread, and contribution patterns to generate
              a recap that feels human, flattering, and weirdly accurate.
            </p>
          </article>
        </section>

        <section className="landing-metrics-panel">
          <div className="landing-metrics-head">
            <div>
              <p className="panel-label">Live or sample highlights</p>
              <h2 className="landing-section-title">
                The homepage should already feel like the first page of the wrapped.
              </h2>
            </div>
            <span className="landing-nav-chip">
              <Github className="h-4 w-4" />
              {githubState.connected ? "Personalized from your account" : "Sample preview"}
            </span>
          </div>

          <div className="landing-summary-grid">
            {summaryHighlights.map((item) => (
              <article key={item.label} className="landing-summary-card">
                <p className="landing-proof-label">{item.label}</p>
                <p className="landing-summary-value">{item.value}</p>
                <p className="landing-summary-copy">{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="privacy" className="landing-privacy-grid">
          <article className="landing-privacy-panel">
            <p className="panel-label">Privacy</p>
            <h2 className="landing-section-title">Say the scary part clearly: we do not read source code.</h2>
            <p className="landing-panel-copy">
              Vibe Tracker uses GitHub repository metadata and pull request stats like merge timing,
              PR titles, additions, deletions, changed file count, and repo names. It does not read
              file contents or clone repositories.
            </p>
            <div className="landing-privacy-list">
              <span>Uses repo metadata</span>
              <span>Uses PR metadata</span>
              <span>Does not read file contents</span>
              <span>Does not clone repos</span>
            </div>
          </article>

          <article className="landing-privacy-panel">
            <p className="panel-label">FAQ</p>
            <div className="landing-faq-list">
              {FAQS.map((item) => (
                <article key={item.question} className="landing-faq-item">
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="landing-final-cta">
          <div className="landing-final-copy">
            <p className="panel-label">Closing thought</p>
            <h2 className="landing-final-title">Your coding era, wrapped.</h2>
            <p className="landing-panel-copy">
              Connect GitHub, generate a recap, and post the part that feels most like you. Keep
              everything else private.
            </p>
          </div>

          <div className="landing-final-actions">
            {!githubState.connected && githubState.primaryAction ? (
              <>
                <ConnectionAction href={githubState.primaryAction.href} label="Get My Wrapped" />
                <ConnectionAction href="/social" label="See Social" tone="secondary" />
              </>
            ) : null}

            {githubState.connected && githubState.installations.length === 0 ? (
              <>
                <ConnectionAction href="/api/github/install" label="Install GitHub App" />
                <ConnectionAction href="/api/session/reset" label="Reset Session" tone="secondary" />
              </>
            ) : null}

            {githubState.connected && githubState.installations.length > 0 ? (
              <>
                <form action="/api/github/activity-sync" method="post">
                  <button
                    type="submit"
                    className="button-primary w-full sm:w-auto"
                    disabled={githubState.activitySyncRunning}
                  >
                    {githubState.activitySyncRunning ? "Refreshing Wrapped" : "Generate Live Wrapped"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
                <ConnectionAction href="/social" label="Open Social" tone="secondary" />
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
