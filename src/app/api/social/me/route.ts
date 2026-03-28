import { NextResponse } from "next/server";

import {
  fetchCloudflareReadJson,
  hasCloudflareWorkerProxy,
} from "@/lib/cloudflare-read";

export async function GET() {
  if (hasCloudflareWorkerProxy()) {
    const proxied = await fetchCloudflareReadJson("/api/social/me");

    if (proxied) {
      return NextResponse.json(proxied);
    }
  }

  return NextResponse.json(
    { error: "Cloudflare social backend is unavailable" },
    { status: 503 },
  );
}
