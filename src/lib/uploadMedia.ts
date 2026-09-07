import * as exifr from "exifr";

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

async function extractGps(file: File): Promise<{ lat: number; lng: number } | null> {
  if (!file.type.startsWith("image/") && !isHeic(file)) return null;
  try {
    const gps = await exifr.gps(file);
    if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
      return { lat: gps.latitude, lng: gps.longitude };
    }
  } catch {
    // 위치 정보 없음
  }
  return null;
}

export async function uploadOneFile(file: File) {
  // EXIF는 변환 전 원본에서 먼저 추출 (변환 과정에서 메타데이터가 사라짐)
  const [takenAt, gps] = await Promise.all([extractTakenAt(file), extractGps(file)]);
  const uploadFile = isHeic(file) ? await convertHeicToJpeg(file) : file;

  const form = new FormData();
  form.set("file", uploadFile);
  form.set("takenAt", String(takenAt));
  if (gps) {
    form.set("latitude", String(gps.lat));
    form.set("longitude", String(gps.lng));
  }

  const res = await fetch("/api/media", { method: "POST", body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `업로드 실패: ${file.name}`);
  }
  return res.json();
}

// 동시 업로드 개수를 제한해서 여러 장을 안정적으로 업로드
export async function uploadFiles(
  files: File[],
  onProgress: (done: number, total: number) => void,
  concurrency = 3
) {
  let done = 0;
  const errors: string[] = [];
  const queue = [...files];

  async function worker() {
    while (queue.length) {
      const file = queue.shift();
      if (!file) return;
      try {
        await uploadOneFile(file);
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
