import type { NextRequest } from "next/server";

import { proxyCloudflareRequest } from "@/lib/cloudflare-read";
import { handleLocalGitHubInstall, shouldUseLocalGitHubAuth } from "@/lib/github-auth-local";

export async function GET(request: NextRequest) {
  if (shouldUseLocalGitHubAuth()) {
    return handleLocalGitHubInstall(request.url);
  }

  return proxyCloudflareRequest(request, "/api/github/install");
}
