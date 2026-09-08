import { NextRequest, NextResponse } from "next/server";
import { getDb, getEnv } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";
import { sendPushToUser } from "@/lib/webpush";

// 업로드 배치(여러 장) 전체가 끝난 뒤 클라이언트가 한 번만 호출 — 파일마다
// 알림을 보내면 사진 10장 올릴 때 알림도 10번 오게 되므로, 개수만 모아서
// 한 번에 보냄
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as {
    photoCount?: number;
    videoCount?: number;
  } | null;
  const photoCount = Math.max(0, Math.floor(Number(body?.photoCount) || 0));
  const videoCount = Math.max(0, Math.floor(Number(body?.videoCount) || 0));
  if (photoCount === 0 && videoCount === 0) {
    return NextResponse.json({ ok: true });
  }

  const db = await getDb();
  const partners = await db
    .prepare("SELECT id FROM users WHERE id != ?")
    .bind(user.id)
    .all<{ id: string }>();
  const partnerIds = partners.results ?? [];
  if (!partnerIds.length) return NextResponse.json({ ok: true });

  const parts: string[] = [];
  if (photoCount > 0) parts.push(`사진 ${photoCount}장`);
  if (videoCount > 0) parts.push(`동영상 ${videoCount}개`);
  const message = `${user.displayName}님이 ${parts.join(", ")}을 올렸어요`;

  const env = await getEnv();
  await Promise.all(
    partnerIds.map((p) => sendPushToUser(env, p.id, { title: "우리 앨범", body: message, url: "/" }))
  );

  return NextResponse.json({ ok: true });
}
