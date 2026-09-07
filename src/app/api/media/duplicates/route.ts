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

  const hashRows = await db
    .prepare(
      `SELECT content_hash as hash FROM media
       WHERE content_hash IS NOT NULL
       GROUP BY content_hash
       HAVING COUNT(*) > 1`
    )
    .all<{ hash: string }>();

  const hashes = (hashRows.results ?? []).map((r) => r.hash);
  if (!hashes.length) {
    return NextResponse.json({ groups: [] });
  }

  const placeholders = hashes.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT m.id as id, m.content_hash as hash, m.type as type, m.taken_at as takenAt,
              m.size_bytes as sizeBytes, m.owner_id as ownerId, u.display_name as ownerName,
              m.thumbnail_r2_key as thumbnailR2Key
       FROM media m
       JOIN users u ON u.id = m.owner_id
       WHERE m.content_hash IN (${placeholders})
       ORDER BY m.taken_at ASC`
    )
    .bind(...hashes)
    .all<{
      id: string;
      hash: string;
      type: "photo" | "video";
      takenAt: number;
      sizeBytes: number;
      ownerId: string;
      ownerName: string;
      thumbnailR2Key: string | null;
    }>();

  const byHash = new Map<
    string,
    { id: string; type: string; takenAt: number; sizeBytes: number; ownerId: string; ownerName: string; hasThumbnail: boolean }[]
  >();
  for (const r of rows.results ?? []) {
    const list = byHash.get(r.hash) ?? [];
    list.push({
      id: r.id,
      type: r.type,
      takenAt: r.takenAt,
      sizeBytes: r.sizeBytes,
      ownerId: r.ownerId,
      ownerName: r.ownerName,
      hasThumbnail: !!r.thumbnailR2Key,
    });
    byHash.set(r.hash, list);
  }

  const groups = Array.from(byHash.entries()).map(([hash, items]) => ({ hash, items }));

  return NextResponse.json({ groups });
}
