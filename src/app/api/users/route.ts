import { NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const db = await getDb();
  const rows = await db
    .prepare("SELECT id, display_name as displayName FROM users ORDER BY created_at ASC")
    .all<{ id: string; displayName: string }>();

  return NextResponse.json({ users: rows.results ?? [] });
}
