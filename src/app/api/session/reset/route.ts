import type { NextRequest } from "next/server";

import { proxyCloudflareRequest } from "@/lib/cloudflare-read";
import { handleLocalSessionReset, shouldUseLocalGitHubAuth } from "@/lib/github-auth-local";

export async function GET(request: NextRequest) {
  if (shouldUseLocalGitHubAuth()) {
    return handleLocalSessionReset(request.url);
  }

  return proxyCloudflareRequest(request, "/api/session/reset");
}
