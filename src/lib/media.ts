export function buildR2Key(userId: string, mediaId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  return `media/${userId}/${mediaId}/${safeName}`;
}

export function detectType(contentType: string): "photo" | "video" | null {
  if (contentType.startsWith("image/")) return "photo";
  if (contentType.startsWith("video/")) return "video";
  return null;
}
