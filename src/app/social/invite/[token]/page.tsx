import Link from "next/link";
import { notFound } from "next/navigation";

import { SocialInviteCard } from "@/components/social-invite-card";
import { getFriendInviteDetails } from "@/lib/social";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function SocialInvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invite = await getFriendInviteDetails(token);

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
          Need GitHub first? <Link href="/api/github/connect" className="underline">Connect now</Link>
        </div>
      </div>
    </main>
  );
}
