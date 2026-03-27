"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Globe2, Link2, Trophy, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDateLabel } from "@/lib/format-date-label";

import type {
  FriendSummary,
  LeaderboardEntry,
  SocialScope,
  SocialTab,
  SocialWindow,
} from "@/lib/social";

type SocialMePayload = {
  profile: {
    accountId: string;
    login: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  settings: {
    bio: string;
    profileVisibility: "PRIVATE" | "PUBLIC";
    leaderboardVisibility: "HIDDEN" | "PUBLIC";
    previewPath: string;
  };
  counts: {
    friendCount: number;
    pendingInviteCount: number;
  };
  score: {
    window: SocialWindow;
    vibeScore: number;
    mergedAdditions: number;
    mergedDeletions: number;
    mergedCommits: number;
    activePeriods: number;
    trendDelta: number;
  };
  ranks: {
    friends: number | null;
    global: number | null;
  };
  defaults: {
    tab: SocialTab;
    scope: SocialScope;
    window: SocialWindow;
  };
};

type SocialFriendsPayload = {
  window: SocialWindow;
  friends: FriendSummary[];
  pendingInvites: Array<{
    token: string;
    invitePath: string;
    createdAt: string;
    expiresAt: string;
  }>;
};

type SocialLeaderboardPayload = {
  scope: SocialScope;
  window: SocialWindow;
  entries: LeaderboardEntry[];
};

type SocialShellProps = {
  initialTab: SocialTab;
  initialScope: SocialScope;
  initialWindow: SocialWindow;
  initialMe: SocialMePayload;
  initialFriends: SocialFriendsPayload;
  initialLeaderboard: SocialLeaderboardPayload;
};

function formatDelta(value: number) {
  if (value === 0) {
    return "Flat";
  }
  return value > 0 ? `+${value}` : `${value}`;
}

export function SocialShell({
  initialTab,
  initialScope,
  initialWindow,
  initialMe,
  initialFriends,
  initialLeaderboard,
}: SocialShellProps) {
  const router = useRouter();
  const [tab, setTab] = useState<SocialTab>(initialTab);
  const [scope, setScope] = useState<SocialScope>(initialScope);
  const [window, setWindow] = useState<SocialWindow>(initialWindow);
  const [me, setMe] = useState(initialMe);
  const [friends, setFriends] = useState(initialFriends);
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const [bio, setBio] = useState(initialMe.settings.bio);
  const [profileVisibility, setProfileVisibility] = useState(
    initialMe.settings.profileVisibility,
  );
  const [leaderboardVisibility, setLeaderboardVisibility] = useState(
    initialMe.settings.leaderboardVisibility,
  );
  const [invitePath, setInvitePath] = useState<string | null>(
    initialFriends.pendingInvites[0]?.invitePath ?? null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const params = new URLSearchParams({
        window,
      });
      const nextFriends = await fetch(`/api/social/friends?${params.toString()}`, {
        cache: "no-store",
      });
      const nextLeaderboard = await fetch(
        `/api/social/leaderboard?${new URLSearchParams({
          scope,
          window,
        }).toString()}`,
        {
          cache: "no-store",
        },
      );

      if (nextFriends.ok) {
        setFriends((await nextFriends.json()) as SocialFriendsPayload);
      }

      if (nextLeaderboard.ok) {
        setLeaderboard((await nextLeaderboard.json()) as SocialLeaderboardPayload);
      }

      router.replace(`/social?tab=${tab}&scope=${scope}&window=${window}`, {
        scroll: false,
      });
    });
  }, [router, scope, tab, window]);

  async function refreshMe() {
    const response = await fetch("/api/social/me", { cache: "no-store" });

    if (response.ok) {
      const payload = (await response.json()) as SocialMePayload;
      setMe(payload);
      setBio(payload.settings.bio);
      setProfileVisibility(payload.settings.profileVisibility);
      setLeaderboardVisibility(payload.settings.leaderboardVisibility);
    }
  }

  async function handleSaveProfile() {
    setMessage(null);
    const response = await fetch("/api/social/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bio,
        profileVisibility,
        leaderboardVisibility,
      }),
    });

    if (!response.ok) {
      setMessage("Unable to save your profile settings right now.");
      return;
    }

    const payload = (await response.json()) as SocialMePayload;
    setMe(payload);
    setMessage("Profile updated.");
  }

  async function handleCopyInvite() {
    setMessage(null);
    const response = await fetch("/api/social/friends/invite", {
      method: "POST",
    });

    if (!response.ok) {
      setMessage("Unable to load your invite link right now.");
      return;
    }

    const payload = (await response.json()) as {
      invitePath: string;
    };

    setInvitePath(payload.invitePath);
    const copied =
      typeof navigator !== "undefined" &&
      typeof navigator.clipboard?.writeText === "function"
        ? await navigator.clipboard
            .writeText(payload.invitePath)
            .then(() => true)
            .catch(() => false)
        : false;

    setMessage(copied ? "Invite link copied." : "Invite link ready.");

    const refreshedFriends = await fetch(`/api/social/friends?window=${window}`, {
      cache: "no-store",
    });
    if (refreshedFriends.ok) {
      setFriends((await refreshedFriends.json()) as SocialFriendsPayload);
    }

    await refreshMe();
  }

  const tabs: Array<{ id: SocialTab; label: string; icon: typeof Users }> = [
    { id: "friends", label: "Friends", icon: Users },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
    { id: "profile", label: "Profile", icon: Globe2 },
  ];
  const windows: SocialWindow[] = ["7d", "30d", "90d"];
  const scopes: SocialScope[] = ["friends", "global"];

  return (
    <div className="space-y-5">
      <section className="top-panel">
        <div className="top-panel-copy">
          <span className="eyebrow">Social</span>
          <div className="space-y-3">
            <h1 className="page-title">Compare activity with friends.</h1>
            <p className="page-description">
              Compare shipped-work activity with friends. You can control public visibility anytime from Profile.
            </p>
          </div>
          <div className="hero-actions">
            <Link href="/" className="button-secondary">
              Back to dashboard
            </Link>
            <button
              type="button"
              className="button-primary"
              onClick={() => void handleCopyInvite()}
              disabled={isPending}
            >
              <Link2 className="h-4 w-4" />
              Copy invite
            </button>
            <ThemeToggle />
          </div>
        </div>

        <div className="top-panel-meta">
          <div className="meta-stack">
            <div className="meta-row">
              <span className="hero-meta-label">30d vibe score</span>
              <span className="hero-meta-value">{me.score.vibeScore}</span>
            </div>
            <div className="meta-row">
              <span className="hero-meta-label">Friends rank</span>
              <span className="hero-meta-value">#{me.ranks.friends ?? "-"}</span>
            </div>
            <div className="meta-row">
              <span className="hero-meta-label">Global rank</span>
              <span className="hero-meta-value">
                {me.ranks.global ? `#${me.ranks.global}` : "Hidden"}
              </span>
            </div>
            <div className="meta-row">
              <span className="hero-meta-label">Pending invites</span>
              <span className="hero-meta-value">{me.counts.pendingInviteCount}</span>
            </div>
          </div>

          <p className="hero-note">
            Score is based on shipped work: merged additions, deletions, commit count, and active periods.
          </p>

          {invitePath ? (
            <div className="rounded-3xl border border-line bg-white/65 p-3 text-sm text-muted">
              Share this link:{" "}
              <Link
                href={invitePath}
                className="break-all font-semibold text-foreground underline"
              >
                {invitePath}
              </Link>
            </div>
          ) : null}

          {message ? <p className="text-sm text-muted">{message}</p> : null}
        </div>
      </section>

      <section className="dashboard-shell">
        <div className="dashboard-head">
          <div className="space-y-3">
            <span className="eyebrow eyebrow-subtle">Social surface</span>
            <h2 className="dashboard-title">@{me.profile.login}</h2>
          </div>

          <div className="control-stack">
            <div className="control-group">
              {tabs.map((entry) => {
                const Icon = entry.icon;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setTab(entry.id)}
                    className={
                      tab === entry.id ? "toggle-pill toggle-pill-active" : "toggle-pill"
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {entry.label}
                  </button>
                );
              })}
            </div>

            <div className="control-group">
              {windows.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setWindow(entry)}
                  className={
                    window === entry ? "toggle-pill toggle-pill-active" : "toggle-pill"
                  }
                >
                  {entry}
                </button>
              ))}
            </div>

            {tab === "leaderboard" ? (
              <div className="control-group">
                {scopes.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setScope(entry)}
                    className={
                      scope === entry ? "toggle-pill toggle-pill-active" : "toggle-pill"
                    }
                  >
                    {entry === "friends" ? "Friends" : "Global"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {tab === "friends" ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
            <div className="space-y-4">
              {friends.friends.length === 0 ? (
                <div className="rounded-[1.75rem] border border-line bg-white/70 p-6">
                  <p className="panel-label">No friends yet</p>
                  <h3 className="panel-heading mt-2 text-3xl">Start with one invite link.</h3>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
                    Share an invite with a friend, let them connect GitHub, and your private leaderboard will update automatically.
                  </p>
                </div>
              ) : (
                friends.friends.map((friend) => (
                  <article
                    key={friend.accountId}
                    className="rounded-[1.75rem] border border-line bg-white/70 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="panel-label">Rank #{friend.rank}</p>
                        <h3 className="panel-heading mt-2 text-3xl">@{friend.login}</h3>
                        {friend.displayName ? (
                          <p className="mt-2 text-sm text-muted">{friend.displayName}</p>
                        ) : null}
                      </div>
                      <Link href={`/social/profile/${friend.login}`} className="toggle-pill">
                        View profile
                      </Link>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-4">
                      <div className="metric-card rounded-[1.5rem] p-4">
                        <p className="metric-label">Score</p>
                        <p className="metric-value">{friend.vibeScore}</p>
                      </div>
                      <div className="metric-card rounded-[1.5rem] p-4">
                        <p className="metric-label">Merged commits</p>
                        <p className="metric-value">{friend.mergedCommits}</p>
                      </div>
                      <div className="metric-card rounded-[1.5rem] p-4">
                        <p className="metric-label">Active periods</p>
                        <p className="metric-value">{friend.activePeriods}</p>
                      </div>
                      <div className="metric-card rounded-[1.5rem] p-4">
                        <p className="metric-label">Trend</p>
                        <p className="metric-value">{formatDelta(friend.trendDelta)}</p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <aside className="sidebar-panel space-y-4">
              <div>
                <p className="panel-label">Active invites</p>
                <h3 className="panel-heading mt-2 text-3xl">Invite link</h3>
              </div>
              {friends.pendingInvites.length === 0 ? (
                <p className="text-sm leading-7 text-muted">
                  No active invite link right now. Copy one when you want to add someone new.
                </p>
              ) : (
                friends.pendingInvites.map((invite) => (
                  <div
                    key={invite.token}
                    className="rounded-[1.5rem] border border-line bg-white/70 p-4"
                  >
                    <Link
                      href={invite.invitePath}
                      className="break-all font-semibold underline"
                    >
                      {invite.invitePath}
                    </Link>
                    <p className="mt-2 text-sm text-muted">
                      Created {formatDateLabel(invite.createdAt)} · Expires{" "}
                      {formatDateLabel(invite.expiresAt)}
                    </p>
                  </div>
                ))
              )}
            </aside>
          </div>
        ) : null}

        {tab === "leaderboard" ? (
          <div className="mt-6 space-y-4">
            {leaderboard.entries.length === 0 ? (
              <div className="rounded-[1.75rem] border border-line bg-white/70 p-6">
                <p className="panel-label">No ranked entries</p>
                <h3 className="panel-heading mt-2 text-3xl">
                  {scope === "global"
                    ? "Nobody is public yet."
                    : "Add friends to see your friends leaderboard."}
                </h3>
              </div>
            ) : (
              leaderboard.entries.map((entry) => (
                <article
                  key={entry.accountId}
                  className={`rounded-[1.75rem] border p-5 ${
                    entry.isCurrentUser
                      ? "border-[rgba(110,132,173,0.4)] bg-[rgba(110,132,173,0.12)]"
                      : "border-line bg-white/70"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="panel-label">Rank #{entry.rank}</p>
                      <h3 className="panel-heading mt-2 text-3xl">@{entry.login}</h3>
                      {entry.displayName ? (
                        <p className="mt-2 text-sm text-muted">{entry.displayName}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="filter-chip">Score {entry.vibeScore}</span>
                      <span className="filter-chip">Trend {formatDelta(entry.trendDelta)}</span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    <div className="metric-card rounded-[1.5rem] p-4">
                      <p className="metric-label">Merged additions</p>
                      <p className="metric-value">+{entry.mergedAdditions}</p>
                    </div>
                    <div className="metric-card rounded-[1.5rem] p-4">
                      <p className="metric-label">Merged deletions</p>
                      <p className="metric-value">-{entry.mergedDeletions}</p>
                    </div>
                    <div className="metric-card rounded-[1.5rem] p-4">
                      <p className="metric-label">Merged commits</p>
                      <p className="metric-value">{entry.mergedCommits}</p>
                    </div>
                    <div className="metric-card rounded-[1.5rem] p-4">
                      <p className="metric-label">Active periods</p>
                      <p className="metric-value">{entry.activePeriods}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : null}

        {tab === "profile" ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <div className="space-y-4 rounded-[1.75rem] border border-line bg-white/70 p-6">
              <div>
                <p className="panel-label">Visibility settings</p>
                <h3 className="panel-heading mt-2 text-3xl">Control your visibility.</h3>
              </div>

              <label className="block text-sm font-semibold text-foreground">
                Bio
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={160}
                  className="mt-2 min-h-28 w-full rounded-[1.4rem] border border-line bg-white px-4 py-3 text-sm text-foreground outline-none"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-foreground">
                  Profile visibility
                  <select
                    value={profileVisibility}
                    onChange={(event) =>
                      setProfileVisibility(event.target.value as "PRIVATE" | "PUBLIC")
                    }
                    className="mt-2 w-full rounded-[1.4rem] border border-line bg-white px-4 py-3 text-sm"
                  >
                    <option value="PRIVATE">Private</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </label>

                <label className="block text-sm font-semibold text-foreground">
                  Leaderboard visibility
                  <select
                    value={leaderboardVisibility}
                    onChange={(event) =>
                      setLeaderboardVisibility(event.target.value as "HIDDEN" | "PUBLIC")
                    }
                    className="mt-2 w-full rounded-[1.4rem] border border-line bg-white px-4 py-3 text-sm"
                  >
                    <option value="HIDDEN">Hidden</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </label>
              </div>

              <button type="button" className="button-primary" onClick={() => void handleSaveProfile()}>
                Save profile settings
              </button>
            </div>

            <aside className="sidebar-panel space-y-4">
              <div>
                <p className="panel-label">Public preview</p>
                <h3 className="panel-heading mt-2 text-3xl">@{me.profile.login}</h3>
              </div>
              <p className="text-sm leading-7 text-muted">
                {bio || "Add a short line so people know who they are looking at."}
              </p>
              <div className="grid gap-3">
                <div className="rounded-[1.5rem] border border-line bg-white/70 p-4">
                  <p className="metric-label">Profile</p>
                  <p className="metric-value">{profileVisibility}</p>
                </div>
                <div className="rounded-[1.5rem] border border-line bg-white/70 p-4">
                  <p className="metric-label">Leaderboard</p>
                  <p className="metric-value">{leaderboardVisibility}</p>
                </div>
              </div>
              <Link href={me.settings.previewPath} className="button-secondary justify-center">
                Open public preview
              </Link>
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  );
}
