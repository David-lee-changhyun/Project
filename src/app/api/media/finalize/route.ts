import { NextRequest, NextResponse } from "next/server";
import { getDb, getBucket } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";
import { buildR2Key, detectType } from "@/lib/media";

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // Workers 요청 바디 제한(무료 100MB) 고려, 여유 있게 안내용 상한

// 업로드 2단계: 클라이언트가 R2에 직접 PUT을 끝낸 뒤 호출. 여기선 파일
// 바이트를 다시 받지 않고, 실제로 R2에 잘 올라갔는지 확인 후 메타데이터만 기록
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as {
    mediaId?: string;
    fileName?: string;
    contentType?: string;
    sizeBytes?: number;
    width?: number;
    height?: number;
    takenAt?: number;
    thumbnailFileName?: string;
    contentHash?: string;
  } | null;

  const mediaId = body?.mediaId;
  const fileName = body?.fileName;
  const contentType = body?.contentType;
  if (!mediaId || !fileName || !contentType) {
    return NextResponse.json({ error: "필수 정보가 없습니다." }, { status: 400 });
  }
  const type = detectType(contentType);
  if (!type) {
    return NextResponse.json({ error: "사진 또는 동영상 파일만 업로드할 수 있습니다." }, { status: 400 });
  }
  const sizeBytes = Number(body?.sizeBytes) || 0;
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "파일이 너무 큽니다 (최대 200MB)." }, { status: 413 });
  }

  const bucket = await getBucket();
  const r2Key = buildR2Key(user.id, mediaId, fileName);
  const thumbnailFileName =
    typeof body?.thumbnailFileName === "string" && body.thumbnailFileName ? body.thumbnailFileName : null;
  const thumbnailR2KeyCandidate = thumbnailFileName ? buildR2Key(user.id, mediaId, thumbnailFileName) : null;

  // presigned URL로 클라이언트가 실제로 R2 업로드를 마쳤는지 확인 (원본/썸네일
  // 둘 다 서로 독립적인 조회라 순차로 기다릴 필요 없이 동시에 확인함).
  // 이 확인 없이 바로 DB에 기록하면, 중간에 업로드가 끊겼는데도
  // 성공한 것처럼 기록되는 유령 항목이 생길 수 있음
  const [uploaded, thumbnailUploaded] = await Promise.all([
    bucket.head(r2Key),
    thumbnailR2KeyCandidate ? bucket.head(thumbnailR2KeyCandidate) : Promise.resolve(null),
  ]);
  if (!uploaded) {
    return NextResponse.json(
      { error: "업로드가 완료되지 않았습니다. 다시 시도해주세요." },
      { status: 409 }
    );
  }
  const thumbnailR2Key = thumbnailUploaded ? thumbnailR2KeyCandidate : null;

  const db = await getDb();
  const now = Date.now();
  const takenAt = Number(body?.takenAt);
  await db
    .prepare(
      `INSERT INTO media
        (id, owner_id, r2_key, type, content_type, file_name, size_bytes, width, height, taken_at, thumbnail_r2_key, content_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      mediaId,
      user.id,
      r2Key,
      type,
      contentType,
      fileName,
      sizeBytes,
      body?.width ? Number(body.width) : null,
      body?.height ? Number(body.height) : null,
      Number.isFinite(takenAt) ? takenAt : now,
      thumbnailR2Key,
      typeof body?.contentHash === "string" ? body.contentHash : null,
      now
    )
    .run();

  return NextResponse.json({ id: mediaId, takenAt: Number.isFinite(takenAt) ? takenAt : now });
}
