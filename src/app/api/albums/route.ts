import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";
import { newId } from "@/lib/ids";

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
      `SELECT a.id as id, a.name as name, a.created_at as createdAt,
              COUNT(am.media_id) as count,
              (SELECT m.id FROM album_media am2 JOIN media m ON m.id = am2.media_id
                 WHERE am2.album_id = a.id ORDER BY m.taken_at DESC LIMIT 1) as coverId
       FROM albums a
       LEFT JOIN album_media am ON am.album_id = a.id
       GROUP BY a.id
       ORDER BY a.created_at DESC`
    )
    .all();

  return NextResponse.json({ albums: rows.results ?? [] });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) {
    return NextResponse.json({ error: "앨범 이름을 입력해주세요." }, { status: 400 });
  }

  const mediaIds = Array.isArray(body?.mediaIds)
    ? (body?.mediaIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];

  const db = await getDb();
  const id = newId("album");
  const now = Date.now();
  await db
    .prepare("INSERT INTO albums (id, name, created_by, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, name, user.id, now)
    .run();

  if (mediaIds.length) {
    const writes = mediaIds.map((mediaId) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO album_media (album_id, media_id, added_at) VALUES (?, ?, ?)"
        )
        .bind(id, mediaId, now)
    );
    await db.batch(writes);
  }

  return NextResponse.json({ id, name });
}
