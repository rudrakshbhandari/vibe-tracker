import type { NextRequest } from "next/server";

import { proxyCloudflareRequest } from "@/lib/cloudflare-read";

export async function PATCH(request: NextRequest) {
  return proxyCloudflareRequest(request, "/api/social/profile");
}
