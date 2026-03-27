import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Sparkles, Users } from "lucide-react";

import { SocialShell } from "@/components/social-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { getOptionalUserSession } from "@/lib/session";
import {
  getSocialFriends,
  getSocialLeaderboard,
  getSocialMe,
  socialScopeSchema,
  socialTabSchema,
  socialWindowSchema,
} from "@/lib/social";

type SocialPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SocialPage({ searchParams }: SocialPageProps) {
  const session = await getOptionalUserSession();

  if (!session) {
    return (
      <main className="page-shell min-h-screen">
        <div className="page-wash" />
        <div className="relative mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <section className="top-panel">
            <div className="top-panel-copy">
              <span className="eyebrow">Social</span>
              <div className="space-y-3">
                <h1 className="page-title">Connect GitHub before you rank the vibe.</h1>
                <p className="page-description">
                  Social runs on the same synced GitHub activity as your personal readout.
                  Sign in first. You&apos;re public on the global board by default, and
                  you can switch that off anytime in Profile.
                </p>
              </div>
              <div className="hero-actions">
                <Link href="/api/github/connect" className="button-primary">
                  Continue with GitHub
                </Link>
                <Link href="/" className="button-secondary">
                  Back home
                </Link>
                <ThemeToggle />
              </div>
            </div>
            <div className="social-preview-panel">
              <div className="social-preview-stack">
                <div className="social-preview-badge">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Private profile, optional leaderboard
                </div>
                <div className="space-y-3">
                  <p className="social-preview-kicker">What unlocks after sign-in</p>
                  <h2 className="social-preview-title">
                    A social layer built on shipped work, not vanity metrics.
                  </h2>
                  <p className="social-preview-copy">
                    Add collaborators, compare momentum across rolling windows, and choose exactly what the public gets to see.
                  </p>
                </div>
              </div>
              <div className="social-preview-grid">
                <article className="social-preview-card">
                  <Users className="h-4 w-4" aria-hidden />
                  <div>
                    <p className="social-preview-label">Friends board</p>
                    <p className="social-preview-detail">
                      See who is shipping steadily across the last 7, 30, or 90 days.
                    </p>
                  </div>
                </article>
                <article className="social-preview-card">
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                  <div>
                    <p className="social-preview-label">Momentum shifts</p>
                    <p className="social-preview-detail">
                      Compare momentum, not just totals, so surges and slowdowns actually stand out.
                    </p>
                  </div>
                </article>
                <article className="social-preview-card">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  <div>
                    <p className="social-preview-label">Visibility controls</p>
                    <p className="social-preview-detail">
                      Step off the public board whenever you want and keep your profile locked down.
                    </p>
                  </div>
                </article>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const params = (await searchParams) ?? {};
  const initialTab = socialTabSchema.safeParse(params.tab).success
    ? (params.tab as "friends" | "leaderboard" | "profile")
    : "friends";
  const initialScope = socialScopeSchema.safeParse(params.scope).success
    ? (params.scope as "friends" | "global")
    : "friends";
  const initialWindow = socialWindowSchema.safeParse(params.window).success
    ? (params.window as "7d" | "30d" | "90d")
    : "30d";

  const [me, friends, leaderboard] = await Promise.all([
    getSocialMe(session.accountId),
    getSocialFriends(session.accountId, initialWindow),
    getSocialLeaderboard(session.accountId, initialScope, initialWindow),
  ]);

  return (
    <main className="page-shell min-h-screen">
      <div className="page-wash" />
      <div className="relative mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <SocialShell
          initialTab={initialTab}
          initialScope={initialScope}
          initialWindow={initialWindow}
          initialMe={me}
          initialFriends={friends}
          initialLeaderboard={leaderboard}
        />
      </div>
    </main>
  );
}
