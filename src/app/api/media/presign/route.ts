import { NextRequest, NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { buildR2Key, detectType } from "@/lib/media";
import { presignR2Put } from "@/lib/r2Presign";

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
    fileName?: string;
    contentType?: string;
    thumbnailFileName?: string;
  } | null;

  const fileName = typeof body?.fileName === "string" && body.fileName ? body.fileName : "upload";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  if (!detectType(contentType)) {
    return NextResponse.json({ error: "사진 또는 동영상 파일만 업로드할 수 있습니다." }, { status: 400 });
  }

  const mediaId = newId("media");
  const r2Key = buildR2Key(user.id, mediaId, fileName);
  const uploadUrl = await presignR2Put(r2Key);

  let thumbnailUploadUrl: string | null = null;
  if (typeof body?.thumbnailFileName === "string" && body.thumbnailFileName) {
    const thumbnailR2Key = buildR2Key(user.id, mediaId, body.thumbnailFileName);
    thumbnailUploadUrl = await presignR2Put(thumbnailR2Key);
  }

  return NextResponse.json({ mediaId, uploadUrl, thumbnailUploadUrl });
}
