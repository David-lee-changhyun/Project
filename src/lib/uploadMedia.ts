import { makeThumbnail } from "@/lib/thumbnail";

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  // 일부 브라우저(특히 안드로이드)는 HEIC를 빈 MIME 타입으로 넘겨서 확장자로도 확인
  return /\.hei[cf]$/i.test(file.name);
}

// 아이폰 HEIC 사진을 갤럭시 등에서도 바로 보이도록 업로드 전 JPEG로 변환
async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const blob = Array.isArray(result) ? result[0] : result;
    const newName = file.name.replace(/\.hei[cf]$/i, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    // 변환 실패 시 원본 그대로 업로드 (서버가 사진/동영상 여부만 검사하므로 실패하진 않음)
    return file;
  }
}

async function extractTakenAt(file: File): Promise<number> {
  if (file.type.startsWith("image/") || isHeic(file)) {
    try {
      // exifr는 업로드할 때만 필요해서 초기 번들에서 빼고 지연 로드
      const exifr = await import("exifr");
      const exif = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
      const date = exif?.DateTimeOriginal ?? exif?.CreateDate;
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date.getTime();
      }
    } catch {
      // EXIF 없음/파싱 실패 시 무시하고 아래 fallback 사용
    }
  }
  return file.lastModified || Date.now();
}

class UploadError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type PreparedUpload = {
  uploadFile: File;
  uploadBuffer: ArrayBuffer;
  thumbnail: File | null;
  takenAt: number;
  contentHash: string;
};

// 변환/썸네일 생성/해시 계산처럼 무거운 작업은 파일당 한 번만 — 재시도 시
// 다시 안 돌리도록 분리. 예전엔 서버가 파일을 받으면서 해시를 계산했는데,
// 이제 서버를 거치지 않고 R2에 직접 올리기 때문에 해시도 여기서 미리 계산해둠
async function prepareUpload(file: File): Promise<PreparedUpload> {
  const [takenAt, uploadFile] = await Promise.all([
    extractTakenAt(file),
    isHeic(file) ? convertHeicToJpeg(file) : Promise.resolve(file),
  ]);
  const type = uploadFile.type.startsWith("video/") ? "video" : "photo";
  const [thumbnail, uploadBuffer] = await Promise.all([
    makeThumbnail(uploadFile, type).catch(() => null),
    uploadFile.arrayBuffer(),
  ]);
  const contentHash = await sha256Hex(uploadBuffer);
  return { uploadFile, uploadBuffer, thumbnail, takenAt, contentHash };
}

async function putDirect(url: string, body: BodyInit, contentType: string, fileName: string) {
  let res: Response;
  try {
    res = await fetch(url, { method: "PUT", body, headers: { "Content-Type": contentType } });
  } catch {
    // 네트워크 오류(연결 끊김, 백그라운드 전환 등) — 재시도 가치 있음
    throw new UploadError(`네트워크 오류: ${fileName}`, true);
  }
  if (!res.ok) {
    // R2 presigned URL 만료/서명 문제 등은 재시도해도 새 URL을 다시 받아야
    // 하므로(=uploadWithRetry가 prepareUpload부터 다시 안 돌리는 한 무의미)
    // 일단 재시도 가능으로 처리해 다음 시도에서 presign을 새로 받게 함
    throw new UploadError(`업로드 실패: ${fileName}`, true);
  }
}

type PresignResult = { mediaId: string; uploadUrl: string; thumbnailUploadUrl: string | null };

async function requestPresign(prepared: PreparedUpload, fileName: string): Promise<PresignResult> {
  let presignRes: Response;
  try {
    presignRes = await fetch("/api/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: prepared.uploadFile.name,
        contentType: prepared.uploadFile.type,
        thumbnailFileName: prepared.thumbnail?.name,
      }),
    });
  } catch {
    throw new UploadError(`네트워크 오류: ${fileName}`, true);
  }
  if (!presignRes.ok) {
    const data = (await presignRes.json().catch(() => ({}))) as { error?: string };
    throw new UploadError(data.error ?? `업로드 준비 실패: ${fileName}`, presignRes.status >= 500);
  }
  return presignRes.json();
}

// R2에 직접 PUT(서버를 거치지 않음) -> 완료 알림(메타데이터 저장)
async function putAndFinalize(prepared: PreparedUpload, presigned: PresignResult, fileName: string) {
  await Promise.all([
    putDirect(presigned.uploadUrl, prepared.uploadBuffer, prepared.uploadFile.type, fileName),
    presigned.thumbnailUploadUrl && prepared.thumbnail
      ? putDirect(presigned.thumbnailUploadUrl, await prepared.thumbnail.arrayBuffer(), "image/jpeg", fileName)
      : Promise.resolve(),
  ]);

  let finalizeRes: Response;
  try {
    finalizeRes = await fetch("/api/media/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaId: presigned.mediaId,
        fileName: prepared.uploadFile.name,
        contentType: prepared.uploadFile.type,
        sizeBytes: prepared.uploadFile.size,
        takenAt: prepared.takenAt,
        thumbnailFileName: prepared.thumbnail?.name,
        contentHash: prepared.contentHash,
      }),
    });
  } catch {
    throw new UploadError(`네트워크 오류: ${fileName}`, true);
  }
  if (!finalizeRes.ok) {
    const data = (await finalizeRes.json().catch(() => ({}))) as { error?: string };
    throw new UploadError(data.error ?? `업로드 완료 처리 실패: ${fileName}`, finalizeRes.status >= 500);
  }
  return finalizeRes.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 네트워크 문제로 실패하면 최대 2번 더 재시도 (파일당 최대 3번 시도).
// prepareUpload(변환/썸네일/해시)는 재시도 때마다 다시 돌리지 않고 재사용하되,
// presign은 매 시도마다 새로 받음 (서명 URL이 만료됐을 가능성 대비)
async function sendWithRetry(prepared: PreparedUpload, fileName: string, maxAttempts = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const presigned = await requestPresign(prepared, fileName);
      return await putAndFinalize(prepared, presigned, fileName);
    } catch (e) {
      lastError = e;
      const retryable = e instanceof UploadError ? e.retryable : true;
      if (!retryable || attempt === maxAttempts) throw e;
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

async function uploadWithRetry(file: File, maxAttempts = 3) {
  const prepared = await prepareUpload(file);
  return sendWithRetry(prepared, file.name, maxAttempts);
}

// 브라우저가 알려주는 "연결 종류"(navigator.connection.type/effectiveType)는
// 신뢰할 수 없음 — 최신 크롬(안드로이드 포함)은 type을 거의 안 주고,
// LTE도 대부분 effectiveType을 '4g'로 보고해서 "셀룰러라 좁다"는 걸 코드로
// 미리 구분하는 게 사실상 불가능함(실제로 이걸로 시도했다가 실기기에서
// 전혀 안 먹혔음). 그래서 연결 종류를 추측하지 않고, 와이파이든 LTE든
// 항상 안전한 방식(파일을 하나씩 순서대로 보내되, 다음 파일 준비와 업로드
// 주소 발급을 지금 파일이 전송되는 동안 미리 해둬서 왕복 대기시간을 숨김)
// 하나로 통일함. presign 요청은 몇 KB짜리라 큰 파일 전송과 같이 나가도
// 대역폭에 영향이 거의 없음
export async function uploadFiles(files: File[], onProgress: (done: number, total: number) => void) {
  let done = 0;
  const total = files.length;
  const errors: string[] = [];
  if (!total) return { errors };

  async function prepareAndPresign(file: File) {
    const prepared = await prepareUpload(file);
    const presigned = await requestPresign(prepared, file.name);
    return { prepared, presigned };
  }

  let next = prepareAndPresign(files[0]).catch(() => null);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const prefetched = await next;
    next = i + 1 < files.length ? prepareAndPresign(files[i + 1]).catch(() => null) : Promise.resolve(null);

    try {
      if (prefetched) {
        await putAndFinalize(prefetched.prepared, prefetched.presigned, file.name);
      } else {
        // 미리 준비/주소 발급이 실패했으면 이 파일은 처음부터 다시 시도
        await uploadWithRetry(file);
      }
    } catch {
      try {
        await uploadWithRetry(file);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    } finally {
      done++;
      onProgress(done, total);
    }
  }

  return { errors };
}
