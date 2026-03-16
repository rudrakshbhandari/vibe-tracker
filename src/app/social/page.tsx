import Link from "next/link";

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
                <h1 className="page-title">Connect GitHub before you compare.</h1>
                <p className="page-description">
                  Social features run on the same synced GitHub activity as your
                  personal dashboard. Sign in first—you&apos;re on the public
                  leaderboard by default, opt out anytime in Profile.
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
