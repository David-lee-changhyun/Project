import { NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

type Row = { type: "photo" | "video"; ownerId: string; ownerName: string; count: number; bytes: number };

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
      `SELECT m.type as type, m.owner_id as ownerId, u.display_name as ownerName,
              COUNT(*) as count, COALESCE(SUM(m.size_bytes), 0) as bytes
       FROM media m
       JOIN users u ON u.id = m.owner_id
       GROUP BY m.type, m.owner_id`
    )
    .all<Row>();

  const results = rows.results ?? [];

  function bucket(type: "photo" | "video") {
    const byOwner = results.filter((r) => r.type === type);
    return {
      totalCount: byOwner.reduce((sum, r) => sum + r.count, 0),
      totalBytes: byOwner.reduce((sum, r) => sum + r.bytes, 0),
      byOwner: byOwner.map((r) => ({
        ownerId: r.ownerId,
        ownerName: r.ownerName,
        count: r.count,
        bytes: r.bytes,
      })),
    };
  }

  return NextResponse.json({ photo: bucket("photo"), video: bucket("video") });
}
