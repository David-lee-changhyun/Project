import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

// 캘린더에 날짜별 업로드 개수 뱃지를 표시하기 위한 가벼운 조회.
// 사진 내용은 전혀 안 가져오고 taken_at(이미 인덱스 있음)만 범위로 조회함.
// 요일별 그룹핑은 서버(UTC)가 아니라 브라우저(사용자의 실제 로컬 시간대)에서
// 하는 게 맞아서, 여기선 그냥 타임스탬프 배열만 돌려줌
export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const from = Number(searchParams.get("from"));
  const to = Number(searchParams.get("to"));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db
    .prepare(`SELECT taken_at as takenAt FROM media WHERE taken_at >= ? AND taken_at < ?`)
    .bind(from, to)
    .all<{ takenAt: number }>();

  return NextResponse.json({ takenAts: (rows.results ?? []).map((r) => r.takenAt) });
}
