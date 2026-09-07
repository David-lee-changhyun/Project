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
      `SELECT t.name as name, COUNT(mt.media_id) as count
       FROM tags t JOIN media_tags mt ON mt.tag_id = t.id
       GROUP BY t.id
       ORDER BY count DESC`
    )
    .all<{ name: string; count: number }>();

  return NextResponse.json({ tags: rows.results ?? [] });
}
