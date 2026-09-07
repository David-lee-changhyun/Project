import * as exifr from "exifr";

export type UploadOptions = {
  tags?: string[];
  locationName?: string;
};

async function extractTakenAt(file: File): Promise<number> {
  if (file.type.startsWith("image/")) {
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
  if (!file.type.startsWith("image/")) return null;
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

export async function uploadOneFile(file: File, opts: UploadOptions = {}) {
  const [takenAt, gps] = await Promise.all([extractTakenAt(file), extractGps(file)]);

  const form = new FormData();
  form.set("file", file);
  form.set("takenAt", String(takenAt));
  if (gps) {
    form.set("latitude", String(gps.lat));
    form.set("longitude", String(gps.lng));
  }
  if (opts.locationName) form.set("locationName", opts.locationName);
  if (opts.tags?.length) form.set("tags", opts.tags.join(","));

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
  opts: UploadOptions,
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
        await uploadOneFile(file, opts);
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
