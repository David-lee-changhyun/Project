const MAX_DIMENSION = 480;
const JPEG_QUALITY = 0.72;

function canvasToJpegFile(canvas: HTMLCanvasElement, baseName: string): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], `${baseName}_thumb.jpg`, { type: "image/jpeg" }) : null),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

function drawScaled(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number
) {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
}

async function imageThumbnail(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    const bitmap = await createImageBitmap(file).catch(async () => {
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      return img;
    });
    const width = "width" in bitmap ? bitmap.width : 0;
    const height = "height" in bitmap ? bitmap.height : 0;
    if (!width || !height) return null;

    const canvas = document.createElement("canvas");
    drawScaled(canvas, bitmap as CanvasImageSource, width, height);
    return await canvasToJpegFile(canvas, file.name);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function videoThumbnail(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = url;

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("video load failed"));
      }),
      6000
    );
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("video seek failed"));
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      }),
      6000
    );

    if (!video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement("canvas");
    drawScaled(canvas, video, video.videoWidth, video.videoHeight);
    return await canvasToJpegFile(canvas, file.name);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// 그리드에서 빠르게 보여줄 작은 미리보기 이미지 생성 (원본은 그대로 유지, 실패해도 업로드는 계속 진행)
export async function makeThumbnail(file: File, type: "photo" | "video"): Promise<File | null> {
  if (typeof document === "undefined") return null;
  return type === "video" ? videoThumbnail(file) : imageThumbnail(file);
}
