import type { NextRequest } from "next/server";

import { proxyCloudflareRequest } from "@/lib/cloudflare-read";

export async function POST(request: NextRequest) {
  return proxyCloudflareRequest(request, "/api/github/activity-sync");
}
