import { NextRequest, NextResponse } from "next/server";

import { getSmokeTestSecret, hasSmokeTestSecret } from "@/lib/env";
import { runHostedSyncSmokeTest } from "@/lib/hosted-sync-smoke";
import { runWorkerReadSmokeTest } from "@/lib/worker-read-smoke";

function isAuthorized(request: NextRequest) {
  if (!hasSmokeTestSecret()) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${getSmokeTestSecret()}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const login = request.nextUrl.searchParams.get("login")?.trim();
    const result = login
      ? await runWorkerReadSmokeTest(login)
      : await runHostedSyncSmokeTest();
    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error("Hosted sync smoke test failed", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Hosted sync smoke test failed",
      },
      { status: 500 },
    );
  }
}
