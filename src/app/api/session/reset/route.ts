import type { NextRequest } from "next/server";

import { proxyCloudflareRequest } from "@/lib/cloudflare-read";

export async function GET(request: NextRequest) {
  return proxyCloudflareRequest(request, "/api/session/reset");
}
