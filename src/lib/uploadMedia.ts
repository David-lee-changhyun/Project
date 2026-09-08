import { makeThumbnail } from "@/lib/thumbnail";
import { newId } from "@/lib/ids";

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
  mediaId: string;
  uploadFile: File;
  uploadBuffer: ArrayBuffer;
  thumbnail: File | null;
  takenAt: number;
  contentHash: string;
};

// 변환/썸네일 생성/해시 계산처럼 무거운 작업은 파일당 한 번만 — 재시도 시
// 다시 안 돌리도록 분리. 예전엔 서버가 파일을 받으면서 해시를 계산했는데,
// 이제 서버를 거치지 않고 R2에 직접 올리기 때문에 해시도 여기서 미리 계산해둠.
// mediaId도 여기서 한 번만 만들어서 재시도 때 그대로 재사용함 — presign을
// 다시 부를 때마다 서버가 새 id를 발급하면, 원본은 이미 R2에 올라갔는데
// 썸네일만 실패해서 재시도하는 경우 새 id로 다시 올라간 원본 때문에
// 이전 id의 원본이 DB에 연결 안 된 채 R2에 영원히 고아로 남게 됨
async function prepareUpload(file: File): Promise<PreparedUpload> {
  const mediaId = newId("media");
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
  return { mediaId, uploadFile, uploadBuffer, thumbnail, takenAt, contentHash };
}

// fetch()는 업로드 진행률 이벤트를 제공하지 않아서(다운로드만 됨), 파일
// 하나가 다 끝나야만 진행률이 움직이는 것처럼 보였음(사진 여러 장이 대역폭을
// 나눠 쓰며 비슷한 시점에 끝나면 "0%로 한참 멈춰있다가 한꺼번에 끝나는"
// 것처럼 보임). XMLHttpRequest는 upload.onprogress로 실제 전송 바이트를
// 알려줘서, 그걸로 막대바를 처음부터 부드럽게 움직이게 함
function putDirect(
  url: string,
  body: ArrayBuffer,
  contentType: string,
  fileName: string,
  onBytes?: (loadedBytes: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    if (onBytes) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onBytes(e.loaded);
      };
    }
    xhr.onerror = () => {
      // 네트워크 오류(연결 끊김, 백그라운드 전환 등) — 재시도 가치 있음
      reject(new UploadError(`네트워크 오류: ${fileName}`, true));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onBytes?.(body.byteLength);
        resolve();
      } else {
        // R2 presigned URL 만료/서명 문제 등은 재시도해도 새 URL을 다시 받아야
        // 하므로(=uploadWithRetry가 prepareUpload부터 다시 안 돌리는 한 무의미)
        // 일단 재시도 가능으로 처리해 다음 시도에서 presign을 새로 받게 함
        reject(new UploadError(`업로드 실패: ${fileName}`, true));
      }
    };
    xhr.send(body);
  });
}

type PresignResult = { uploadUrl: string; thumbnailUploadUrl: string | null };

async function requestPresign(prepared: PreparedUpload, fileName: string): Promise<PresignResult> {
  let presignRes: Response;
  try {
    presignRes = await fetch("/api/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaId: prepared.mediaId,
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

// R2에 직접 PUT(서버를 거치지 않음) -> 완료 알림(메타데이터 저장).
// onBytes는 원본 파일 전송 바이트만 추적함(썸네일은 원본보다 훨씬 작아서
// 진행률 계산에 안 넣어도 체감상 차이 없음) — 델타(증가분)로 콜백해서
// 여러 파일의 진행 바이트를 하나의 전체 진행률로 그냥 더하기만 하면 되게 함
async function putAndFinalize(
  prepared: PreparedUpload,
  presigned: PresignResult,
  fileName: string,
  onBytes?: (delta: number) => void
) {
  let originalLoaded = 0;
  await Promise.all([
    putDirect(presigned.uploadUrl, prepared.uploadBuffer, prepared.uploadFile.type, fileName, (loaded) => {
      onBytes?.(loaded - originalLoaded);
      originalLoaded = loaded;
    }),
    presigned.thumbnailUploadUrl && prepared.thumbnail
      ? putDirect(
          presigned.thumbnailUploadUrl,
          await prepared.thumbnail.arrayBuffer(),
          "image/jpeg",
          fileName
        )
      : Promise.resolve(),
  ]);

  let finalizeRes: Response;
  try {
    finalizeRes = await fetch("/api/media/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaId: prepared.mediaId,
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
async function sendWithRetry(
  prepared: PreparedUpload,
  fileName: string,
  onBytes?: (delta: number) => void,
  maxAttempts = 3
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const presigned = await requestPresign(prepared, fileName);
      return await putAndFinalize(prepared, presigned, fileName, onBytes);
    } catch (e) {
      lastError = e;
      const retryable = e instanceof UploadError ? e.retryable : true;
      if (!retryable || attempt === maxAttempts) throw e;
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

async function uploadWithRetry(file: File, onBytes?: (delta: number) => void, maxAttempts = 3) {
  const prepared = await prepareUpload(file);
  return sendWithRetry(prepared, file.name, onBytes, maxAttempts);
}

async function prepareAndPresign(file: File) {
  const prepared = await prepareUpload(file);
  const presigned = await requestPresign(prepared, file.name);
  return { prepared, presigned };
}

// 큰 파일(동영상 등)이 올라가는 동안 다른 파일이 하나도 못 올라가면
// 진행률이 통째로 멈춘 것처럼 보임(실제로 수 초~수십 초씩 그래 보임).
// 그렇다고 큰 파일을 여러 개 동시에 보내는 건 대역폭만 나눠 갖고 손해라,
// "작은 파일들은 동시에 여러 개, 큰 파일은 한 번에 하나씩" 두 줄을
// 따로 돌려서 큰 파일이 올라가는 동안에도 작은 파일들은 계속 진행되게 함.
// 각 줄 안에서도 "다음 파일 준비 + 업로드 주소 발급"을 지금 파일이 실제로
// 전송되는 동안 미리 해둬서 왕복 대기시간을 숨김
const LARGE_FILE_BYTES = 20 * 1024 * 1024;

async function runPool(
  queue: File[],
  poolConcurrency: number,
  errors: string[],
  onFileDone: () => void,
  onBytes: (delta: number) => void
) {
  async function worker() {
    let file = queue.shift();
    let next = file ? prepareAndPresign(file).catch(() => null) : null;
    while (file) {
      const currentFile = file;
      const prefetched = await next;
      file = queue.shift();
      next = file ? prepareAndPresign(file).catch(() => null) : null;

      try {
        if (prefetched) {
          await putAndFinalize(prefetched.prepared, prefetched.presigned, currentFile.name, onBytes);
        } else {
          // 미리 준비/주소 발급 자체가 실패했으면 이 파일은 처음부터 다시 시도.
          // uploadWithRetry가 이미 자체적으로 최대 3번 재시도하므로, 이게 실패하면
          // 더 재시도하지 않고 바로 실패 처리함 (안 그러면 아래 catch에서 또
          // uploadWithRetry를 불러서 한 파일에 최대 6번까지 재시도하게 됨)
          await uploadWithRetry(currentFile, onBytes);
        }
      } catch (e) {
        if (!prefetched) {
          errors.push(e instanceof Error ? e.message : String(e));
        } else {
          try {
            // uploadWithRetry(currentFile)로 처음부터 다시 준비하면 mediaId도
            // 새로 발급돼서, 원본은 이미 R2에 올라갔는데 썸네일만 실패한
            // 경우 이전 mediaId의 원본이 고아로 남게 됨. 이미 준비된
            // prefetched.prepared(mediaId 포함)를 그대로 재사용해서 재시도함
            await sendWithRetry(prefetched.prepared, currentFile.name, onBytes);
          } catch (e2) {
            errors.push(e2 instanceof Error ? e2.message : String(e2));
          }
        }
      } finally {
        onFileDone();
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(poolConcurrency, queue.length) }, worker));
}

export type UploadProgress = {
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
};

export async function uploadFiles(
  files: File[],
  onProgress: (progress: UploadProgress) => void,
  concurrency = 4
) {
  let done = 0;
  const total = files.length;
  const bytesTotal = files.reduce((sum, f) => sum + f.size, 0);
  let bytesDone = 0;
  const errors: string[] = [];
  if (!total) return { errors };

  const report = () =>
    onProgress({ done, total, bytesDone: Math.min(bytesDone, bytesTotal), bytesTotal });

  const onFileDone = () => {
    done++;
    report();
  };
  const onBytes = (delta: number) => {
    bytesDone += delta;
    report();
  };

  const small = files.filter((f) => f.size < LARGE_FILE_BYTES);
  const large = files.filter((f) => f.size >= LARGE_FILE_BYTES);

  await Promise.all([
    runPool(small, concurrency, errors, onFileDone, onBytes),
    runPool(large, 1, errors, onFileDone, onBytes),
  ]);

  return { errors };
}
