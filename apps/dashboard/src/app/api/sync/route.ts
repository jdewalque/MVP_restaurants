import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

// Protected by src/proxy.ts: admin cookie or "Authorization: Bearer <SYNC_SECRET>".
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const creatorId = new URL(request.url).searchParams.get("creator") ?? undefined;
  try {
    const summary = await runSync({ trigger: "api", creatorId });
    return NextResponse.json(summary, { status: summary.status === "failed" ? 502 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed" }, { status: 500 });
  }
}
