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

// createImageBitmap에 resizeWidth를 주면 이 크기로 "딱 맞춰서" 만들기 때문에,
// 원본이 이미 이 값보다 작으면 오히려 확대(업스케일)돼서 화질이 나빠짐.
// 실제 카메라 사진(수백 KB~수 MB)에서만 의미 있는 최적화라, 화면 캡처/스티커
// 처럼 작은 파일에는 적용하지 않기 위한 기준
const RESIZE_HINT_MIN_BYTES = 400 * 1024;

async function imageThumbnail(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    // resizeWidth를 주면 브라우저가 디코딩 단계에서 바로 축소해서 만들어줌.
    // 옵션 없이 createImageBitmap(file)만 부르면 4000만 화소짜리 원본을
    // 일단 통째로 픽셀로 풀어낸(수백MB 메모리 + 긴 시간) 다음에야 캔버스에서
    // 축소하는 꼴이라, 업로드 시작 전에 매 사진마다 그 디코딩 시간이 그대로
    // 딜레이로 잡혔음. 세로/가로 어느 쪽이 긴 변인지는 미리 알 수 없어서
    // width만 맞추고, 정확한 "긴 변 기준 480px" 크기는 아래 drawScaled에서
    // (이미 작아진 비트맵 기준이라 사실상 공짜로) 마무리함.
    // 다만 원본이 480px보다 작을 수도 있는 작은 파일은 업스케일을 피하기
    // 위해 이 힌트 없이 원래 크기 그대로 디코딩함
    const bitmap = await createImageBitmap(
      file,
      file.size >= RESIZE_HINT_MIN_BYTES
        ? { resizeWidth: MAX_DIMENSION, resizeQuality: "medium" }
        : {}
    ).catch(async () => {
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
