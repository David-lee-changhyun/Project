import { NextRequest, NextResponse } from "next/server";
import { getDb, getBucket } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { attachTags, buildR2Key, detectType } from "@/lib/media";

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // Workers 요청 바디 제한(무료 100MB) 고려, 여유 있게 안내용 상한

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "파일이 너무 큽니다 (최대 200MB)." }, { status: 413 });
  }

  const type = detectType(file.type);
  if (!type) {
    return NextResponse.json({ error: "사진 또는 동영상 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  const takenAtRaw = form.get("takenAt");
  const takenAt = takenAtRaw ? Number(takenAtRaw) : Date.now();
  const widthRaw = form.get("width");
  const heightRaw = form.get("height");
  const locationName = form.get("locationName");
  const latitudeRaw = form.get("latitude");
  const longitudeRaw = form.get("longitude");
  const tagsRaw = form.get("tags"); // comma-separated

  const mediaId = newId("media");
  const r2Key = buildR2Key(user.id, mediaId, file.name || "upload");

  const bucket = await getBucket();
  await bucket.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const db = await getDb();
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO media
        (id, owner_id, r2_key, type, content_type, file_name, size_bytes, width, height, taken_at, location_name, latitude, longitude, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      mediaId,
      user.id,
      r2Key,
      type,
      file.type,
      file.name || "upload",
      file.size,
      widthRaw ? Number(widthRaw) : null,
      heightRaw ? Number(heightRaw) : null,
      Number.isFinite(takenAt) ? takenAt : now,
      typeof locationName === "string" && locationName ? locationName : null,
      latitudeRaw ? Number(latitudeRaw) : null,
      longitudeRaw ? Number(longitudeRaw) : null,
      now
    )
    .run();

  if (typeof tagsRaw === "string" && tagsRaw.trim()) {
    await attachTags(db, mediaId, tagsRaw.split(","));
  }

  return NextResponse.json({ id: mediaId, takenAt: Number.isFinite(takenAt) ? takenAt : now });
}

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  void user; // 두 사람 모두 모든 미디어를 공유해서 볼 수 있음 (공유 앨범)

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 60) || 60, 100);
  const cursor = searchParams.get("cursor"); // taken_at 기준 cursor (ms)
  const tag = searchParams.get("tag");
  const location = searchParams.get("location");
  const type = searchParams.get("type");
  const uploader = searchParams.get("uploader"); // owner_id로 업로더 필터 (전체/나/상대방)

  const db = await getDb();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (cursor) {
    conditions.push("m.taken_at < ?");
    params.push(Number(cursor));
  }
  if (location) {
    conditions.push("m.location_name = ?");
    params.push(location);
  }
  if (type === "photo" || type === "video") {
    conditions.push("m.type = ?");
    params.push(type);
  }
  if (uploader) {
    conditions.push("m.owner_id = ?");
    params.push(uploader);
  }
  if (tag) {
    conditions.push(
      "m.id IN (SELECT mt.media_id FROM media_tags mt JOIN tags t ON t.id = mt.tag_id WHERE t.name = ?)"
    );
    params.push(tag);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await db
    .prepare(
      `SELECT m.id as id, m.type as type, m.content_type as contentType, m.file_name as fileName,
              m.size_bytes as sizeBytes, m.width as width, m.height as height, m.taken_at as takenAt,
              m.location_name as locationName, m.latitude as latitude, m.longitude as longitude,
              m.created_at as createdAt, m.owner_id as ownerId, u.display_name as ownerName
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

  const ids = page.map((r) => r.id as string);
  let tagsByMedia = new Map<string, string[]>();
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const tagRows = await db
      .prepare(
        `SELECT mt.media_id as mediaId, t.name as name
         FROM media_tags mt JOIN tags t ON t.id = mt.tag_id
         WHERE mt.media_id IN (${placeholders})`
      )
      .bind(...ids)
      .all<{ mediaId: string; name: string }>();
    tagsByMedia = new Map();
    for (const row of tagRows.results ?? []) {
      const list = tagsByMedia.get(row.mediaId) ?? [];
      list.push(row.name);
      tagsByMedia.set(row.mediaId, list);
    }
  }

  const items = page.map((r) => ({
    id: r.id,
    type: r.type,
    contentType: r.contentType,
    fileName: r.fileName,
    sizeBytes: r.sizeBytes,
    width: r.width,
    height: r.height,
    takenAt: r.takenAt,
    locationName: r.locationName,
    latitude: r.latitude,
    longitude: r.longitude,
    createdAt: r.createdAt,
    ownerId: r.ownerId,
    ownerName: r.ownerName,
    tags: tagsByMedia.get(r.id as string) ?? [],
  }));

  const nextCursor = hasMore ? String(page[page.length - 1].takenAt) : null;

  return NextResponse.json({ items, nextCursor });
}

export async function DELETE(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
  void user;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (!ids.length) {
    return NextResponse.json({ error: "삭제할 항목이 없습니다." }, { status: 400 });
  }

  const db = await getDb();
  const bucket = await getBucket();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await db
    .prepare(`SELECT id, r2_key as r2Key FROM media WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<{ id: string; r2Key: string }>();

  const found = rows.results ?? [];
  await Promise.all(found.map((r) => bucket.delete(r.r2Key)));
  await db
    .prepare(`DELETE FROM media WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run();

  return NextResponse.json({ deleted: found.length });
}
