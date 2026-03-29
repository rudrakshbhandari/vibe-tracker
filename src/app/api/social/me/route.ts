import { NextRequest, NextResponse } from "next/server";

import {
  hasCloudflareWorkerProxy,
  proxyCloudflareRequest,
} from "@/lib/cloudflare-read";

export async function GET(request: NextRequest) {
  if (hasCloudflareWorkerProxy()) {
    return proxyCloudflareRequest(request, "/api/social/me");
  }

  return NextResponse.json(
    { error: "Cloudflare social backend is unavailable" },
    { status: 503 },
  );
}
