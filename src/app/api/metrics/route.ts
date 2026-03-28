import { NextRequest, NextResponse } from "next/server";

import {
  fetchCloudflareReadJson,
  hasCloudflareReadProxy,
} from "@/lib/cloudflare-read";
import { getMetricsResponseAsync, metricsQuerySchema } from "@/lib/metrics";
import { getOptionalUserSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const parseResult = metricsQuerySchema.safeParse({
    view: request.nextUrl.searchParams.get("view") ?? undefined,
    mode: request.nextUrl.searchParams.get("mode") ?? undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        issues: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const session = await getOptionalUserSession();
  if (hasCloudflareReadProxy() && session) {
    const proxied = await fetchCloudflareReadJson(
      `/api/metrics?${new URLSearchParams({
        view: parseResult.data.view,
        mode: parseResult.data.mode,
      }).toString()}`,
      { accountId: session.accountId },
    );

    if (proxied) {
      return NextResponse.json(proxied);
    }
  }

  return NextResponse.json(await getMetricsResponseAsync(parseResult.data));
}
