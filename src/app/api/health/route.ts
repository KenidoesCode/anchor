import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/pg";

export const dynamic = "force-dynamic";

/** Health check for the container/orchestrator. Reports DB reachability. */
export async function GET() {
  try {
    await (await getDb()).execute(sql`select 1`);
    return NextResponse.json({ status: "ok", db: "up" });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
