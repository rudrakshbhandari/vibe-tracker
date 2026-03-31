import type { ComponentProps } from "react";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Sparkles, Users } from "lucide-react";

import { SocialShell } from "@/components/social-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { getLinkPrefetch } from "@/lib/link-prefetch";
import {
  fetchCloudflareReadJson,
  hasCloudflareSessionCookie,
  hasCloudflareWorkerProxy,
} from "@/lib/cloudflare-read";
import { socialScopeSchema, socialTabSchema, socialWindowSchema } from "@/lib/social";
import { getOptionalUserSession } from "@/lib/session";

type SocialPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type SocialShellProps = ComponentProps<typeof SocialShell>;

export default async function SocialPage({ searchParams }: SocialPageProps) {
  const hasSession = await hasCloudflareSessionCookie();

  let accountId: string | null = null;
  if (hasCloudflareWorkerProxy()) {
    try {
      const session = await getOptionalUserSession();
      accountId = session?.accountId ?? null;
    } catch {
      // DB/session lookup can fail on cold starts or connection issues;
      // fall through to anonymous rendering instead of crashing the page.
    }
  }

  if (!hasSession || !hasCloudflareWorkerProxy()) {
    return (
      <main className="page-shell min-h-screen">
        <div className="page-wash" />
        <div className="relative mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <section className="top-panel">
            <div className="top-panel-copy">
              <span className="eyebrow">Social</span>
              <div className="space-y-3">
                <h1 className="page-title">Connect GitHub before you use social.</h1>
                <p className="page-description">
                  Social uses the same synced GitHub activity as your personal dashboard.
                  Sign in first. You&apos;re visible on the global leaderboard by default,
                  and you can change that anytime in Profile.
                </p>
              </div>
              <div className="hero-actions">
                <Link
                  href="/api/github/connect"
                  prefetch={getLinkPrefetch("/api/github/connect")}
                  className="button-primary"
                >
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
                  Private profile, public leaderboard
                </div>
                <div className="space-y-3">
                  <p className="social-preview-kicker">What unlocks after sign-in</p>
                  <h2 className="social-preview-title">
                    A simple social layer for shipped work.
                  </h2>
                  <p className="social-preview-copy">
                    Add friends, compare activity over rolling windows, and control what appears on your public profile.
                  </p>
                </div>
              </div>
              <div className="social-preview-grid">
                <article className="social-preview-card">
                  <Users className="h-4 w-4" aria-hidden />
                  <div>
                    <p className="social-preview-label">Friends leaderboard</p>
                    <p className="social-preview-detail">
                      See who is shipping steadily across the last 7, 30, or 90 days.
                    </p>
                  </div>
                </article>
                <article className="social-preview-card">
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                  <div>
                    <p className="social-preview-label">Recent trend</p>
                    <p className="social-preview-detail">
                      Compare recent movement, not just totals, so changes over time are easier to see.
                    </p>
                  </div>
                </article>
                <article className="social-preview-card">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  <div>
                    <p className="social-preview-label">Visibility controls</p>
                    <p className="social-preview-detail">
                      Opt out of the public board whenever you want and keep your profile private.
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

  const workerPayloads: [
    SocialShellProps["initialMe"] | null,
    SocialShellProps["initialFriends"] | null,
    SocialShellProps["initialLeaderboard"] | null,
  ] = hasCloudflareWorkerProxy()
    ? await Promise.all([
        fetchCloudflareReadJson<SocialShellProps["initialMe"]>("/api/social/me", {
          accountId,
        }),
        fetchCloudflareReadJson(
          `/api/social/friends?${new URLSearchParams({
            window: initialWindow,
          }).toString()}`,
          {
            accountId,
          },
        ) as Promise<SocialShellProps["initialFriends"] | null>,
        fetchCloudflareReadJson(
          `/api/social/leaderboard?${new URLSearchParams({
            scope: initialScope,
            window: initialWindow,
          }).toString()}`,
          {
            accountId,
          },
        ) as Promise<SocialShellProps["initialLeaderboard"] | null>,
      ])
    : [null, null, null];

  const [me, friends, leaderboard] = workerPayloads;

  if (!me || !friends || !leaderboard) {
    return (
      <main className="page-shell min-h-screen">
        <div className="page-wash" />
        <div className="relative mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <section className="top-panel">
            <div className="top-panel-copy">
              <span className="eyebrow">Social</span>
              <div className="space-y-3">
                <h1 className="page-title">Social is temporarily unavailable.</h1>
                <p className="page-description">
                  The Cloudflare social backend did not respond. Refresh the page after the worker is available again.
                </p>
              </div>
              <div className="hero-actions">
                <Link href="/" className="button-secondary">
                  Back home
                </Link>
                <ThemeToggle />
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

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
