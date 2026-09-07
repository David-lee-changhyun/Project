import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/cloudflare";
import { newId } from "@/lib/ids";

export const SESSION_COOKIE = "session_id";
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60일 (둘만 쓰는 앱이라 로그인 유지 길게)

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const db = await getDb();
  const sessionId = newId("sess");
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
    )
    .bind(sessionId, userId, now + SESSION_TTL_MS, now)
    .run();
  return sessionId;
}

export async function setSessionCookie(sessionId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function destroySession(sessionId: string) {
  const db = await getDb();
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT u.id as id, u.email as email, u.display_name as displayName, s.expires_at as expiresAt
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .bind(sessionId)
    .first<{ id: string; email: string; displayName: string; expiresAt: number }>();

  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await destroySession(sessionId);
    return null;
  }

  return { id: row.id, email: row.email, displayName: row.displayName };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("로그인이 필요합니다.");
  }
  return user;
}

export class AuthError extends Error {}
