import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const db = await getDb();
  const user = await db
    .prepare(
      "SELECT id, email, password_hash as passwordHash, display_name as displayName FROM users WHERE email = ?"
    )
    .bind(email)
    .first<{ id: string; email: string; passwordHash: string; displayName: string }>();

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const sessionId = await createSession(user.id);
  await setSessionCookie(sessionId);

  return NextResponse.json({ id: user.id, email: user.email, displayName: user.displayName });
}
