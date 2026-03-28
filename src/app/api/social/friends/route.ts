import { NextRequest, NextResponse } from "next/server";

import {
  fetchCloudflareReadJson,
  hasCloudflareWorkerProxy,
} from "@/lib/cloudflare-read";
import { socialWindowSchema } from "@/lib/social";

export async function GET(request: NextRequest) {
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

  if (hasCloudflareWorkerProxy()) {
    const proxied = await fetchCloudflareReadJson(
      `/api/social/friends?${new URLSearchParams({
        window: parseResult.data,
      }).toString()}`,
    );

    if (proxied) {
      return NextResponse.json(proxied);
    }
  }

  return NextResponse.json(
    { error: "Cloudflare social backend is unavailable" },
    { status: 503 },
  );
}
