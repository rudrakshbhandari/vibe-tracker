import { NextRequest, NextResponse } from "next/server";

import {
  fetchCloudflareReadJson,
  hasCloudflareReadProxy,
} from "@/lib/cloudflare-read";
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

  if (hasCloudflareReadProxy()) {
    const proxied = await fetchCloudflareReadJson(
      `/api/social/friends?${new URLSearchParams({
        window: parseResult.data,
      }).toString()}`,
      { accountId: session.accountId },
    );

    if (proxied) {
      return NextResponse.json(proxied);
    }
  }

  return NextResponse.json(await getSocialFriends(session.accountId, parseResult.data));
}
