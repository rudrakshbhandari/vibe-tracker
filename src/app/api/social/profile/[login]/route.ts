import { NextRequest, NextResponse } from "next/server";

import {
  hasCloudflareWorkerProxy,
  proxyCloudflareRequest,
} from "@/lib/cloudflare-read";

type RouteContext = {
  params: Promise<{
    login: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { login } = await context.params;

  if (hasCloudflareWorkerProxy()) {
    return proxyCloudflareRequest(
      request,
      `/api/social/profile/${encodeURIComponent(login)}`,
    );
  }

  return NextResponse.json(
    { error: "Cloudflare social backend is unavailable" },
    { status: 503 },
  );
}
