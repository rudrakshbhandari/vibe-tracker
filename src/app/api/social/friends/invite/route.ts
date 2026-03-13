import { NextResponse } from "next/server";

import { createFriendInvite, getRequiredSocialSession } from "@/lib/social";

export async function POST() {
  const session = await getRequiredSocialSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await createFriendInvite(session.accountId));
}
