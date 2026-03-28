import { NextResponse } from "next/server";

import {
  fetchCloudflareReadJson,
  hasCloudflareReadProxy,
} from "@/lib/cloudflare-read";
import { getRequiredSocialSession, getSocialMe } from "@/lib/social";

export async function GET() {
  const session = await getRequiredSocialSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (hasCloudflareReadProxy()) {
    const proxied = await fetchCloudflareReadJson("/api/social/me", {
      accountId: session.accountId,
    });

    if (proxied) {
      return NextResponse.json(proxied);
    }
  }

  return NextResponse.json(await getSocialMe(session.accountId));
}
