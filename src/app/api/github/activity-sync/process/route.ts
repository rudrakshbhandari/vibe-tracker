import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    status: "retired",
  }, { status: 410 });
}
