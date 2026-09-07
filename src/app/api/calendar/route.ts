import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";
import { newId } from "@/lib/ids";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT id, title, event_date as eventDate, kind, repeat_yearly as repeatYearly, memo, created_at as createdAt
       FROM calendar_events ORDER BY event_date ASC`
    )
    .all();

  return NextResponse.json({ events: rows.results ?? [] });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const eventDate = Number(body?.eventDate);
  const kind = body?.kind === "anniversary" ? "anniversary" : "event";
  const repeatYearly = kind === "anniversary" || body?.repeatYearly === true;
  const memo = typeof body?.memo === "string" ? body.memo.trim() : null;

  if (!title || !Number.isFinite(eventDate)) {
    return NextResponse.json({ error: "제목과 날짜를 입력해주세요." }, { status: 400 });
  }

  const db = await getDb();
  const id = newId("evt");
  await db
    .prepare(
      `INSERT INTO calendar_events (id, created_by, title, event_date, kind, repeat_yearly, memo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, user.id, title, eventDate, kind, repeatYearly ? 1 : 0, memo, Date.now())
    .run();

  return NextResponse.json({ id });
}
