import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb, getBucket } from "@/lib/cloudflare";
import { SESSION_COOKIE } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const db = await getDb();

  // 그리드 하나에 썸네일 수십 개가 동시에 요청되는 가장 뜨거운 경로라
  // 세션 확인 + 미디어 조회를 순차 왕복 2번이 아니라 batch()로 한 번에 묶어서 보냄
  const [sessionResult, mediaResult] = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT expires_at as expiresAt FROM sessions WHERE id = ?`).bind(sessionId),
    db
      .prepare(
        `SELECT r2_key as r2Key, content_type as contentType, file_name as fileName,
                thumbnail_r2_key as thumbnailR2Key
         FROM media WHERE id = ?`
      )
      .bind(id),
  ]);

  const session = sessionResult.results?.[0] as { expiresAt: number } | undefined;
  if (!session || session.expiresAt < Date.now()) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const media = mediaResult.results?.[0] as
    | { r2Key: string; contentType: string; fileName: string; thumbnailR2Key: string | null }
    | undefined;
  if (!media) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const download = searchParams.get("download") === "1";
  // 그리드용 작은 미리보기 요청: 썸네일이 있으면 그걸, 없으면 원본으로 대체
  const wantThumb = searchParams.get("thumb") === "1";
  const useThumb = wantThumb && !!media.thumbnailR2Key;

  const bucket = await getBucket();
  const object = await bucket.get(useThumb ? media.thumbnailR2Key! : media.r2Key);
  if (!object) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", useThumb ? "image/jpeg" : media.contentType);
  headers.set("Content-Length", String(object.size));
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  if (download) {
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(media.fileName)}"`
    );
  }

  return new NextResponse(object.body as unknown as ReadableStream, { headers });
}
