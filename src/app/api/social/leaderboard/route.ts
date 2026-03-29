import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  hasCloudflareWorkerProxy,
  proxyCloudflareRequest,
} from "@/lib/cloudflare-read";
import { socialScopeSchema, socialWindowSchema } from "@/lib/social";

const leaderboardQuerySchema = z.object({
  scope: socialScopeSchema.default("friends"),
  window: socialWindowSchema.default("30d"),
});

export async function GET(request: NextRequest) {
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

  if (hasCloudflareWorkerProxy()) {
    return proxyCloudflareRequest(
      request,
      `/api/social/leaderboard?${new URLSearchParams({
        scope: parseResult.data.scope,
        window: parseResult.data.window,
      }).toString()}`,
    );
  }

  return NextResponse.json(
    { error: "Cloudflare social backend is unavailable" },
    { status: 503 },
  );
}
