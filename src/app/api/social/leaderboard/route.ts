import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getRequiredSocialSession,
  getSocialLeaderboard,
  socialScopeSchema,
  socialWindowSchema,
} from "@/lib/social";

const leaderboardQuerySchema = z.object({
  scope: socialScopeSchema.default("friends"),
  window: socialWindowSchema.default("30d"),
});

export async function GET(request: NextRequest) {
  const session = await getRequiredSocialSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parseResult = leaderboardQuerySchema.safeParse({
    scope: request.nextUrl.searchParams.get("scope") ?? undefined,
    window: request.nextUrl.searchParams.get("window") ?? undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid leaderboard query",
        issues: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    await getSocialLeaderboard(
      session.accountId,
      parseResult.data.scope,
      parseResult.data.window,
    ),
  );
}
