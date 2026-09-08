import { NextRequest, NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { buildR2Key, detectType } from "@/lib/media";
import { presignR2Put } from "@/lib/r2Presign";

// media_ 뒤에 nanoid 21자리(숫자+대소문자) — src/lib/ids.ts의 형식과 동일
const MEDIA_ID_PATTERN = /^media_[0-9A-Za-z]{21}$/;

// 업로드 1단계: R2에 직접 올릴 수 있는 서명된 URL만 발급 (파일 바이트는 아직 안 옴)
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
    thumbnailFileName?: string;
  } | null;

  const fileName = typeof body?.fileName === "string" && body.fileName ? body.fileName : "upload";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  if (!detectType(contentType)) {
    return NextResponse.json({ error: "사진 또는 동영상 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  // mediaId는 클라이언트가 만들어서 보냄 — 재시도할 때도 같은 id를 재사용해야
  // (원본은 R2에 올라갔는데 썸네일만 실패해 재시도하는 경우 등) 새 id로
  // 다시 올라간 원본 때문에 이전 id의 원본이 고아로 남는 걸 막을 수 있음.
  // R2 키 경로에 그대로 쓰이므로 형식을 엄격히 검증해서 경로 조작을 막음
  if (typeof body?.mediaId !== "string" || !MEDIA_ID_PATTERN.test(body.mediaId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const mediaId = body.mediaId;
  const r2Key = buildR2Key(user.id, mediaId, fileName);
  const hasThumbnail = typeof body?.thumbnailFileName === "string" && !!body.thumbnailFileName;
  const thumbnailR2Key = hasThumbnail ? buildR2Key(user.id, mediaId, body!.thumbnailFileName!) : null;

  // 원본/썸네일 서명 URL은 서로 독립적이라 순차로 기다릴 필요 없이 동시에 발급
  const [uploadUrl, thumbnailUploadUrl] = await Promise.all([
    presignR2Put(r2Key),
    thumbnailR2Key ? presignR2Put(thumbnailR2Key) : Promise.resolve(null),
  ]);

  // mediaId는 클라이언트가 이미 알고 있는 값이라(자기가 만들어 보냄) 다시 안 돌려줌
  return NextResponse.json({ uploadUrl, thumbnailUploadUrl });
}
