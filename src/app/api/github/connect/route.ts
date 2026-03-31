import type { NextRequest } from "next/server";

import { proxyCloudflareRequest } from "@/lib/cloudflare-read";
import { handleLocalGitHubConnect, shouldUseLocalGitHubAuth } from "@/lib/github-auth-local";

export async function GET(request: NextRequest) {
  if (shouldUseLocalGitHubAuth()) {
    return handleLocalGitHubConnect(request.url);
  }

  return proxyCloudflareRequest(request, "/api/github/connect");
}
