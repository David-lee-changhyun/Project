import { newId } from "@/lib/ids";

export type MediaItem = {
  id: string;
  type: "photo" | "video";
  contentType: string;
  fileName: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  takenAt: number;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: number;
  tags: string[];
};

export function buildR2Key(userId: string, mediaId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  return `media/${userId}/${mediaId}/${safeName}`;
}

export function detectType(contentType: string): "photo" | "video" | null {
  if (contentType.startsWith("image/")) return "photo";
  if (contentType.startsWith("video/")) return "video";
  return null;
}

// 태그 이름 배열을 받아 없으면 생성하고 media_tags 연결까지 처리
export async function attachTags(db: D1Database, mediaId: string, tagNames: string[]) {
  const cleaned = Array.from(
    new Set(
      tagNames
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => t.slice(0, 30))
    )
  ).slice(0, 20);

  for (const name of cleaned) {
    let tag = await db
      .prepare("SELECT id FROM tags WHERE name = ?")
      .bind(name)
      .first<{ id: string }>();
    if (!tag) {
      const tagId = newId("tag");
      await db
        .prepare("INSERT INTO tags (id, name) VALUES (?, ?)")
        .bind(tagId, name)
        .run();
      tag = { id: tagId };
    }
    await db
      .prepare(
        "INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)"
      )
      .bind(mediaId, tag.id)
      .run();
  }
}

export function rowToMediaItem(row: Record<string, unknown>): Omit<MediaItem, "tags"> {
  return {
    id: row.id as string,
    type: row.type as "photo" | "video",
    contentType: row.contentType as string,
    fileName: row.fileName as string,
    sizeBytes: row.sizeBytes as number,
    width: (row.width as number) ?? null,
    height: (row.height as number) ?? null,
    takenAt: row.takenAt as number,
    locationName: (row.locationName as string) ?? null,
    latitude: (row.latitude as number) ?? null,
    longitude: (row.longitude as number) ?? null,
    createdAt: row.createdAt as number,
  };
}
