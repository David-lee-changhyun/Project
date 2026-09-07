import { NextRequest, NextResponse } from "next/server";
import { getDb, getBucket } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

export async function GET(
  req: NextRequest,
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
    .prepare(
      "SELECT r2_key as r2Key, content_type as contentType, file_name as fileName FROM media WHERE id = ?"
    )
    .bind(id)
    .first<{ r2Key: string; contentType: string; fileName: string }>();

  if (!media) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  const bucket = await getBucket();
  const object = await bucket.get(media.r2Key);
  if (!object) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  const headers = new Headers();
  headers.set("Content-Type", media.contentType);
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
