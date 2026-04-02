import type { NextRequest } from "next/server";

import { proxyCloudflareRequest } from "@/lib/cloudflare-read";
import { handleLocalGitHubCallback, shouldUseLocalGitHubAuth } from "@/lib/github-auth-local";

export async function GET(request: NextRequest) {
  if (shouldUseLocalGitHubAuth()) {
    return handleLocalGitHubCallback(request.url, {
      code: request.nextUrl.searchParams.get("code"),
      state: request.nextUrl.searchParams.get("state"),
    });
  }

  return proxyCloudflareRequest(
    request,
    `/api/github/callback${request.nextUrl.search}`,
  );
}
