"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, ChevronLeft, ChevronRight, Heart, FolderClosed, Plus, Trash2 } from "lucide-react";
import Timeline from "@/components/Timeline";
import type { Album } from "@/lib/types";

type LocationChip = { name: string; count: number };

export default function AlbumsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const albumId = searchParams.get("album");
  const location = searchParams.get("location");
  const liked = searchParams.get("liked") === "1";

  const [locations, setLocations] = useState<LocationChip[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumName, setAlbumName] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  function loadAlbums() {
    fetch("/api/albums")
      .then((r) => r.json() as Promise<{ albums: Album[] }>)
      .then((d) => setAlbums(d.albums ?? []));
  }

  useEffect(() => {
    if (albumId || location || liked) return;
    fetch("/api/media/locations")
      .then((r) => r.json() as Promise<{ locations: LocationChip[] }>)
      .then((d) => setLocations(d.locations ?? []));
    loadAlbums();
  }, [albumId, location, liked]);

  useEffect(() => {
    if (!albumId) return;
    fetch(`/api/albums/${albumId}`)
      .then((r) => r.json() as Promise<{ album?: { name: string } }>)
      .then((d) => setAlbumName(d.album?.name ?? null));
  }, [albumId]);

  async function createAlbum(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await fetch("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewName("");
    setShowCreate(false);
    loadAlbums();
  }

  async function deleteAlbum(id: string, name: string): Promise<boolean> {
    if (!confirm(`"${name}" 앨범을 삭제할까요? (사진은 그대로 남아있어요)`)) return false;
    await fetch(`/api/albums/${id}`, { method: "DELETE" });
    loadAlbums();
    return true;
  }

  if (albumId || location || liked) {
    const title = liked ? "좋아요" : albumId ? albumName ?? "앨범" : location;
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-1 px-2 py-2">
          <button
            onClick={() => router.push("/albums")}
            className="tap-scale flex items-center gap-0.5 px-2 py-1.5 text-[15px] text-accent"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
            앨범
          </button>
        </div>
        <div className="flex items-center justify-between px-4 pb-2">
          <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
          {albumId && (
            <button
              onClick={async () => {
                const deleted = await deleteAlbum(albumId, albumName ?? "앨범");
                if (deleted) router.push("/albums");
              }}
              className="tap-scale flex items-center gap-1 text-[13px] text-danger"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
              앨범 삭제
            </button>
          )}
        </div>
        <Timeline
          filterAlbum={albumId ?? undefined}
          filterLocation={location ?? undefined}
          filterLiked={liked}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4 md:py-8">
      <section className="mb-8">
        <button
          onClick={() => router.push("/albums?liked=1")}
          className="tap-scale flex w-full items-center gap-3 rounded-[14px] bg-surface px-4 py-3 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-pink/15 text-accent-pink">
            <Heart className="h-4 w-4" fill="currentColor" strokeWidth={0} />
          </span>
          <span className="flex-1 text-[15px] font-medium text-foreground">좋아요</span>
          <ChevronRight className="h-4 w-4 text-muted-2" strokeWidth={2} />
        </button>
      </section>

      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">앨범</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="tap-scale flex items-center gap-1 text-[13px] font-medium text-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            새 앨범
          </button>
        </div>
        {albums.length === 0 ? (
          <p className="px-1 text-[14px] text-muted">아직 만든 앨범이 없어요.</p>
        ) : (
          <div className="overflow-hidden rounded-[14px] bg-surface">
            {albums.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "hairline-t" : ""}`}
              >
                <button
                  onClick={() => router.push(`/albums?album=${a.id}`)}
                  className="tap-scale flex flex-1 items-center gap-3 text-left"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                    <FolderClosed className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="flex-1 text-[15px] text-foreground">{a.name}</span>
                  <span className="text-[13px] text-muted">{a.count}</span>
                </button>
                <button
                  onClick={() => deleteAlbum(a.id, a.name)}
                  aria-label="앨범 삭제"
                  className="tap-scale text-muted-2"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
          장소
        </h2>
        {locations.length === 0 ? (
          <p className="px-1 text-[14px] text-muted">GPS 정보가 있는 사진이 아직 없어요.</p>
        ) : (
          <div className="overflow-hidden rounded-[14px] bg-surface">
            {locations.map((l, i) => (
              <button
                key={l.name}
                onClick={() => router.push(`/albums?location=${encodeURIComponent(l.name)}`)}
                className={`tap-scale flex w-full items-center gap-3 px-4 py-3 text-left ${
                  i > 0 ? "hairline-t" : ""
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                  <MapPin className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="flex-1 text-[15px] text-foreground">{l.name}</span>
                <span className="text-[13px] text-muted">{l.count}</span>
                <ChevronRight className="h-4 w-4 text-muted-2" strokeWidth={2} />
              </button>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
          <form
            onSubmit={createAlbum}
            className="w-full max-w-sm rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-[28px] sm:pb-5"
          >
            <div className="sheet-handle sm:hidden" />
            <h3 className="mb-4 text-[17px] font-semibold">새 앨범</h3>
            <input
              autoFocus
              className="mb-5 w-full rounded-[14px] bg-background px-4 py-3 text-[15px] outline-none"
              placeholder="앨범 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="tap-scale flex-1 rounded-[14px] bg-background py-3 text-[15px] font-medium text-foreground"
              >
                취소
              </button>
              <button
                type="submit"
                className="tap-scale flex-1 rounded-[14px] bg-accent py-3 text-[15px] font-semibold text-white"
              >
                만들기
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
