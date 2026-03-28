import { NextRequest, NextResponse } from "next/server";

import {
  fetchCloudflareReadJson,
  hasCloudflareWorkerProxy,
} from "@/lib/cloudflare-read";

type RouteContext = {
  params: Promise<{
    login: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { login } = await context.params;

  if (hasCloudflareWorkerProxy()) {
    const proxied = await fetchCloudflareReadJson(
      `/api/social/profile/${encodeURIComponent(login)}`,
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
