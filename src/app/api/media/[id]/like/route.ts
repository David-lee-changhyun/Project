import { NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

// 좋아요 토글: 이미 좋아요면 취소, 아니면 좋아요 표시
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { id } = await params;
  const db = await getDb();
  const media = await db
    .prepare("SELECT liked_at as likedAt FROM media WHERE id = ?")
    .bind(id)
    .first<{ likedAt: number | null }>();

  if (!media) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const nextLikedAt = media.likedAt ? null : Date.now();
  await db.prepare("UPDATE media SET liked_at = ? WHERE id = ?").bind(nextLikedAt, id).run();

  return NextResponse.json({ likedAt: nextLikedAt });
}
