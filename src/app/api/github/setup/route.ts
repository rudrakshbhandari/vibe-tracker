import type { NextRequest } from "next/server";

import { proxyCloudflareRequest } from "@/lib/cloudflare-read";
import { handleLocalGitHubSetup, shouldUseLocalGitHubAuth } from "@/lib/github-auth-local";

export async function GET(request: NextRequest) {
  if (shouldUseLocalGitHubAuth()) {
    return handleLocalGitHubSetup(
      request.url,
      request.nextUrl.searchParams.get("installation_id"),
    );
  }

  return proxyCloudflareRequest(
    request,
    `/api/github/setup${request.nextUrl.search}`,
  );
}
