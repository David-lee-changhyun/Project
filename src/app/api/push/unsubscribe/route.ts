import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) {
    return NextResponse.json({ error: "endpoint가 필요합니다." }, { status: 400 });
  }

  const db = await getDb();
  // 본인 소유 구독만 지울 수 있게 user_id도 같이 확인 — 안 그러면 로그인한
  // 사람이면 누구든 endpoint 문자열만 알아내서 남의 알림을 끌 수 있었음
  await db
    .prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?")
    .bind(body.endpoint, user.id)
    .run();

  return NextResponse.json({ ok: true });
}
