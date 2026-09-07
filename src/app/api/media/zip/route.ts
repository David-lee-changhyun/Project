import { NextRequest, NextResponse } from "next/server";
import { downloadZip } from "client-zip";
import { getDb, getBucket } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

// 여러 사진/동영상을 zip으로 스트리밍 다운로드 (서버 메모리에 전부 올리지 않음)
export async function POST(req: NextRequest) {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown) => typeof x === "string")
    : [];
  if (!ids.length) {
    return NextResponse.json({ error: "다운로드할 항목이 없습니다." }, { status: 400 });
  }
  if (ids.length > 300) {
    return NextResponse.json({ error: "한 번에 최대 300개까지 가능합니다." }, { status: 400 });
  }

  const db = await getDb();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT id, r2_key as r2Key, file_name as fileName FROM media WHERE id IN (${placeholders})`
    )
    .bind(...ids)
    .all<{ id: string; r2Key: string; fileName: string }>();

  const found = rows.results ?? [];
  const bucket = await getBucket();

  const usedNames = new Set<string>();
  const uniqueName = (name: string) => {
    let candidate = name;
    let i = 1;
    while (usedNames.has(candidate)) {
      const dot = name.lastIndexOf(".");
      candidate = dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`;
      i++;
    }
    usedNames.add(candidate);
    return candidate;
  };

  async function* entries() {
    for (const row of found) {
      const object = await bucket.get(row.r2Key);
      if (!object) continue;
      yield {
        name: uniqueName(row.fileName),
        input: object.body as unknown as ReadableStream,
        size: object.size,
      };
    }
  }

  const response = downloadZip(entries());
  const headers = new Headers(response.headers);
  headers.set("Content-Disposition", `attachment; filename="shared-album.zip"`);
  return new NextResponse(response.body, { headers });
}
