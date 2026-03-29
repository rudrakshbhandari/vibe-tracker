import type { NextRequest } from "next/server";

import { proxyCloudflareRequest } from "@/lib/cloudflare-read";

type RouteContext = {
  params: Promise<{
    installationId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { installationId: installationIdParam } = await context.params;
  return proxyCloudflareRequest(
    request,
    `/api/github/installations/${installationIdParam}/scope/recommended`,
  );
}
