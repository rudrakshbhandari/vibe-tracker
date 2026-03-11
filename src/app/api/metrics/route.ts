import { NextRequest, NextResponse } from "next/server";

import { getMetricsResponseAsync, metricsQuerySchema } from "@/lib/metrics";

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

  return NextResponse.json(await getMetricsResponseAsync(parseResult.data));
}
