import Link from "next/link";
import { notFound } from "next/navigation";

import { SocialInviteCard } from "@/components/social-invite-card";
import { fetchCloudflareReadJson, hasCloudflareWorkerProxy } from "@/lib/cloudflare-read";
import { getLinkPrefetch } from "@/lib/link-prefetch";

type SocialInvitePayload = {
  token: string;
  status: string;
  expiresAt: string;
  inviter: {
    id: string;
    login: string;
    displayName: string | null;
  };
};

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function SocialInvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = hasCloudflareWorkerProxy()
    ? await fetchCloudflareReadJson<SocialInvitePayload>(
        `/api/social/invite/${encodeURIComponent(token)}`,
      )
    : null;

  if (!invite) {
    notFound();
  }

  return (
    <main className="page-shell min-h-screen">
      <div className="page-wash" />
      <div className="relative mx-auto flex w-full max-w-[960px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <SocialInviteCard
          token={invite.token}
          inviter={{
            login: invite.inviter.login,
            displayName: invite.inviter.displayName,
          }}
          status={invite.status}
          expiresAt={invite.expiresAt}
        />
        <div className="text-sm text-muted">
          Need to connect first?{" "}
          <Link
            href="/api/github/connect"
            prefetch={getLinkPrefetch("/api/github/connect")}
            className="underline"
          >
            Continue with GitHub
          </Link>
        </div>
      </div>
    </main>
  );
}
