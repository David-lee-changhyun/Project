import { NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT location_name as name, COUNT(*) as count
       FROM media
       WHERE location_name IS NOT NULL AND location_name != ''
       GROUP BY location_name
       ORDER BY count DESC`
    )
    .all<{ name: string; count: number }>();

  return NextResponse.json({ locations: rows.results ?? [] });
}
