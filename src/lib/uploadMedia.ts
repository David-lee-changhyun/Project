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

// 변환/썸네일 생성처럼 무거운 작업은 파일당 한 번만 — 재시도 시 다시 안 돌리도록 분리
async function prepareUpload(file: File): Promise<FormData> {
  const [takenAt, uploadFile] = await Promise.all([
    extractTakenAt(file),
    isHeic(file) ? convertHeicToJpeg(file) : Promise.resolve(file),
  ]);
  const type = uploadFile.type.startsWith("video/") ? "video" : "photo";
  const thumbnail = await makeThumbnail(uploadFile, type).catch(() => null);

  const form = new FormData();
  form.set("file", uploadFile);
  form.set("takenAt", String(takenAt));
  if (thumbnail) form.set("thumbnail", thumbnail);
  return form;
}

async function sendUpload(form: FormData, fileName: string) {
  let res: Response;
  try {
    res = await fetch("/api/media", { method: "POST", body: form });
  } catch {
    // 네트워크 오류(연결 끊김, 백그라운드 전환 등) — 재시도 가치 있음
    throw new UploadError(`네트워크 오류: ${fileName}`, true);
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    // 4xx(파일 형식/용량 문제 등)는 다시 시도해도 똑같이 실패하므로 재시도 안 함
    throw new UploadError(data.error ?? `업로드 실패: ${fileName}`, res.status >= 500);
  }
  return res.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 네트워크 문제로 실패하면 최대 2번 더 재시도 (파일당 최대 3번 시도)
async function uploadWithRetry(file: File, maxAttempts = 3) {
  const form = await prepareUpload(file);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await sendUpload(form, file.name);
    } catch (e) {
      lastError = e;
      const retryable = e instanceof UploadError ? e.retryable : true;
      if (!retryable || attempt === maxAttempts) throw e;
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

// 동시 업로드 개수를 제한해서 여러 장을 안정적으로 업로드
export async function uploadFiles(
  files: File[],
  onProgress: (done: number, total: number) => void,
  concurrency = 4
) {
  let done = 0;
  const errors: string[] = [];
  const queue = [...files];

  async function worker() {
    while (queue.length) {
      const file = queue.shift();
      if (!file) return;
      try {
        await uploadWithRetry(file);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      } finally {
        done++;
        onProgress(done, files.length);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return { errors };
}
