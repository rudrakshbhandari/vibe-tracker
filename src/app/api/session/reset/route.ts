import { NextRequest, NextResponse } from "next/server";

import { clearUserSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  await clearUserSession();
  return NextResponse.redirect(new URL("/?github=session-reset", request.url));
}
