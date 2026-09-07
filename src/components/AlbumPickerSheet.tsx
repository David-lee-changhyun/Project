"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { Album } from "@/lib/types";

export default function AlbumPickerSheet({
  mediaIds,
  onClose,
  onDone,
}: {
  mediaIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/albums")
      .then((r) => r.json() as Promise<{ albums: Album[] }>)
      .then((d) => setAlbums(d.albums ?? []));
  }, []);

  async function addTo(albumId: string) {
    setBusy(true);
    await fetch(`/api/albums/${albumId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaIds }),
    });
    setBusy(false);
    onDone();
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    await fetch("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mediaIds }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-[28px] sm:pb-5">
        <div className="sheet-handle sm:hidden" />
        <h3 className="mb-4 text-[17px] font-semibold">앨범에 추가 ({mediaIds.length}개)</h3>

        <form onSubmit={createAndAdd} className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded-[14px] bg-background px-4 py-3 text-[15px] outline-none"
            placeholder="새 앨범 이름"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className="tap-scale flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-accent text-white disabled:opacity-40"
            aria-label="새 앨범 만들고 추가"
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </form>

        {albums.length > 0 && (
          <div className="mb-4 max-h-64 overflow-y-auto rounded-[14px]">
            {albums.map((a, i) => (
              <button
                key={a.id}
                disabled={busy}
                onClick={() => addTo(a.id)}
                className={`tap-scale flex w-full items-center justify-between bg-background px-4 py-3 text-left text-[15px] disabled:opacity-40 ${
                  i > 0 ? "hairline-t" : ""
                }`}
              >
                <span>{a.name}</span>
                <span className="text-[13px] text-muted">{a.count}장</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="tap-scale w-full rounded-[14px] bg-background py-3 text-[15px] font-medium text-foreground"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
