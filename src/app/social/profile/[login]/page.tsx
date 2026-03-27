import Link from "next/link";
import { notFound } from "next/navigation";

import { getOptionalUserSession } from "@/lib/session";
import { getSocialProfileByLogin } from "@/lib/social";

type ProfilePageProps = {
  params: Promise<{
    login: string;
  }>;
};

export default async function SocialProfilePage({ params }: ProfilePageProps) {
  const { login } = await params;
  const session = await getOptionalUserSession();
  const profile = await getSocialProfileByLogin(login, session?.accountId);

  if (!profile) {
    notFound();
  }

  return (
    <main className="page-shell min-h-screen">
      <div className="page-wash" />
      <div className="relative mx-auto flex w-full max-w-[960px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <section className="top-panel">
          <div className="top-panel-copy">
            <span className="eyebrow">Public profile</span>
            <div className="space-y-3">
              <h1 className="page-title">@{profile.login}</h1>
              <p className="page-description">
                {profile.bio || "A public profile with recent shipped-work activity."}
              </p>
            </div>
            <div className="hero-actions">
              <Link href="/social" className="button-secondary">
                Back to social
              </Link>
            </div>
          </div>

          <div className="top-panel-meta">
            <div className="meta-stack">
              <div className="meta-row">
                <span className="hero-meta-label">30d vibe score</span>
                <span className="hero-meta-value">{profile.vibeScore}</span>
              </div>
              <div className="meta-row">
                <span className="hero-meta-label">Global rank</span>
                <span className="hero-meta-value">
                  {profile.globalRank ? `#${profile.globalRank}` : "Hidden"}
                </span>
              </div>
              <div className="meta-row">
                <span className="hero-meta-label">Trend</span>
                <span className="hero-meta-value">
                  {profile.trendDelta > 0 ? `+${profile.trendDelta}` : profile.trendDelta}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-shell">
          <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="metric-card rounded-[1.5rem] p-5">
              <p className="metric-label">Merged additions</p>
              <p className="metric-value">+{profile.mergedAdditions}</p>
            </article>
            <article className="metric-card rounded-[1.5rem] p-5">
              <p className="metric-label">Merged deletions</p>
              <p className="metric-value">-{profile.mergedDeletions}</p>
            </article>
            <article className="metric-card rounded-[1.5rem] p-5">
              <p className="metric-label">Merged commits</p>
              <p className="metric-value">{profile.mergedCommits}</p>
            </article>
            <article className="metric-card rounded-[1.5rem] p-5">
              <p className="metric-label">Active periods</p>
              <p className="metric-value">{profile.activePeriods}</p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
