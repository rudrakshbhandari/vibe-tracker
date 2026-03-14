import { NextResponse } from "next/server";

import { getRequiredSocialSession, getSocialMe } from "@/lib/social";

export async function GET() {
  const session = await getRequiredSocialSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getSocialMe(session.accountId));
}
