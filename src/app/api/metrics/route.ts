import { NextRequest, NextResponse } from "next/server";

import {
  fetchCloudflareReadJson,
  hasCloudflareWorkerProxy,
} from "@/lib/cloudflare-read";
import { metricsQuerySchema } from "@/lib/metrics";

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

  if (hasCloudflareWorkerProxy()) {
    const proxied = await fetchCloudflareReadJson(
      `/api/metrics?${new URLSearchParams({
        view: parseResult.data.view,
        mode: parseResult.data.mode,
      }).toString()}`,
    );

    if (proxied) {
      return NextResponse.json(proxied);
    }
  }

  return NextResponse.json(
    { error: "Cloudflare metrics backend is unavailable" },
    { status: 503 },
  );
}
