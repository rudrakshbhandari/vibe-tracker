import { NextRequest, NextResponse } from "next/server";

import { getMetricsResponse, metricsQuerySchema } from "@/lib/metrics";

export function GET(request: NextRequest) {
  const parseResult = metricsQuerySchema.safeParse({
    window: request.nextUrl.searchParams.get("window") ?? undefined,
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

  return NextResponse.json(getMetricsResponse(parseResult.data));
}
