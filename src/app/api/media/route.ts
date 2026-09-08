import { NextRequest, NextResponse } from "next/server";
import { getDb, getBucket } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

// 업로드(파일 바이트 수신)는 /api/media/presign + /api/media/finalize로 이동함.
// 클라이언트가 R2에 직접 PUT하고, 여긴 조회/삭제만 담당 (자세한 이유는
// /api/media/presign/route.ts, /api/media/finalize/route.ts 참고)

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 60) || 60, 100);
  const cursor = searchParams.get("cursor"); // taken_at 기준 cursor (ms)
  const type = searchParams.get("type");
  const uploader = searchParams.get("uploader"); // owner_id로 업로더 필터 (전체/나/상대방)
  const albumId = searchParams.get("album");
  const liked = searchParams.get("liked");

  const db = await getDb();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (cursor) {
    conditions.push("m.taken_at < ?");
    params.push(Number(cursor));
  }
  if (type === "photo" || type === "video") {
    conditions.push("m.type = ?");
    params.push(type);
  }
  if (uploader) {
    conditions.push("m.owner_id = ?");
    params.push(uploader);
  }
  if (albumId) {
    conditions.push("m.id IN (SELECT media_id FROM album_media WHERE album_id = ?)");
    params.push(albumId);
  }
  if (liked === "1") {
    conditions.push("m.liked_at IS NOT NULL");
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await db
    .prepare(
      `SELECT m.id as id, m.type as type, m.content_type as contentType, m.file_name as fileName,
              m.size_bytes as sizeBytes, m.width as width, m.height as height, m.taken_at as takenAt,
              m.created_at as createdAt, m.owner_id as ownerId, u.display_name as ownerName,
              m.liked_at as likedAt, m.thumbnail_r2_key as thumbnailR2Key
       FROM media m
       JOIN users u ON u.id = m.owner_id
       ${where}
       ORDER BY m.taken_at DESC
       LIMIT ?`
    )
    .bind(...params, limit + 1)
    .all<Record<string, unknown>>();

  const results = rows.results ?? [];
  const hasMore = results.length > limit;
  const page = hasMore ? results.slice(0, limit) : results;

  const items = page.map((r) => ({
    id: r.id,
    type: r.type,
    contentType: r.contentType,
    fileName: r.fileName,
    sizeBytes: r.sizeBytes,
    width: r.width,
    height: r.height,
    takenAt: r.takenAt,
    createdAt: r.createdAt,
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    likedAt: r.likedAt,
    hasThumbnail: !!r.thumbnailR2Key,
  }));

  const nextCursor = hasMore ? String(page[page.length - 1].takenAt) : null;

  return NextResponse.json({ items, nextCursor });
}

export async function DELETE(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (!ids.length) {
    return NextResponse.json({ error: "삭제할 항목이 없습니다." }, { status: 400 });
  }

  const db = await getDb();
  const bucket = await getBucket();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT id, r2_key as r2Key, thumbnail_r2_key as thumbnailR2Key FROM media WHERE id IN (${placeholders})`
    )
    .bind(...ids)
    .all<{ id: string; r2Key: string; thumbnailR2Key: string | null }>();

  const found = rows.results ?? [];
  await Promise.all(
    found.flatMap((r) => [
      bucket.delete(r.r2Key),
      ...(r.thumbnailR2Key ? [bucket.delete(r.thumbnailR2Key)] : []),
    ])
  );
  await db
    .prepare(`DELETE FROM media WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run();

  return NextResponse.json({ deleted: found.length });
}
