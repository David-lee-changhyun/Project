import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

function parseMediaIds(body: Record<string, unknown> | null): string[] {
  return Array.isArray(body?.mediaIds)
    ? (body?.mediaIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mediaIds = parseMediaIds(body);
  if (!mediaIds.length) {
    return NextResponse.json({ error: "추가할 항목이 없습니다." }, { status: 400 });
  }

  const db = await getDb();
  const now = Date.now();
  const writes = mediaIds.map((mediaId) =>
    db
      .prepare("INSERT OR IGNORE INTO album_media (album_id, media_id, added_at) VALUES (?, ?, ?)")
      .bind(id, mediaId, now)
  );
  await db.batch(writes);

  return NextResponse.json({ added: mediaIds.length });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mediaIds = parseMediaIds(body);
  if (!mediaIds.length) {
    return NextResponse.json({ error: "제거할 항목이 없습니다." }, { status: 400 });
  }

  const db = await getDb();
  const placeholders = mediaIds.map(() => "?").join(",");
  await db
    .prepare(`DELETE FROM album_media WHERE album_id = ? AND media_id IN (${placeholders})`)
    .bind(id, ...mediaIds)
    .run();

  return NextResponse.json({ removed: mediaIds.length });
}
