import { NextRequest, NextResponse } from "next/server";
import { getDb, getEnv } from "@/lib/cloudflare";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { newId } from "@/lib/ids";

// 초대 코드 없이 아무나 가입하지 못하도록 방지 (둘만 쓰는 프라이빗 앱)
// wrangler secret put SIGNUP_INVITE_CODE 로 설정
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode : "";

  if (!email || !email.includes("@") || password.length < 8 || !displayName) {
    return NextResponse.json(
      { error: "이메일, 8자 이상 비밀번호, 이름을 모두 입력해주세요." },
      { status: 400 }
    );
  }

  const env = await getEnv();
  const requiredInvite = (env as unknown as { SIGNUP_INVITE_CODE?: string }).SIGNUP_INVITE_CODE;
  if (requiredInvite && inviteCode !== requiredInvite) {
    return NextResponse.json({ error: "초대 코드가 올바르지 않습니다." }, { status: 403 });
  }

  const db = await getDb();

  // 둘만 쓰는 앱: 최대 2개 계정으로 제한
  const countRow = await db
    .prepare("SELECT COUNT(*) as count FROM users")
    .first<{ count: number }>();
  if ((countRow?.count ?? 0) >= 2) {
    return NextResponse.json(
      { error: "이미 두 명의 계정이 등록되어 더 이상 가입할 수 없습니다." },
      { status: 403 }
    );
  }

  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) {
    return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const userId = newId("user");
  await db
    .prepare(
      "INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(userId, email, passwordHash, displayName, Date.now())
    .run();

  const sessionId = await createSession(userId);
  await setSessionCookie(sessionId);

  return NextResponse.json({ id: userId, email, displayName });
}
