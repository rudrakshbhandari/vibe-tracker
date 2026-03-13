import { NextRequest, NextResponse } from "next/server";

import {
  getRequiredSocialSession,
  getSocialFriends,
  socialWindowSchema,
} from "@/lib/social";

export async function GET(request: NextRequest) {
  const session = await getRequiredSocialSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parseResult = socialWindowSchema.safeParse(
    request.nextUrl.searchParams.get("window") ?? "30d",
  );

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid leaderboard window",
        issues: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  return NextResponse.json(await getSocialFriends(session.accountId, parseResult.data));
}
