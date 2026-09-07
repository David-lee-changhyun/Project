import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  const db = await getDb();
  const album = await db
    .prepare("SELECT id, name, created_at as createdAt FROM albums WHERE id = ?")
    .bind(id)
    .first();

  if (!album) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ album });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  const db = await getDb();
  // 앨범만 삭제하고 실제 사진/동영상은 그대로 유지 (album_media는 CASCADE로 함께 삭제)
  await db.prepare("DELETE FROM albums WHERE id = ?").bind(id).run();

  return NextResponse.json({ ok: true });
}
