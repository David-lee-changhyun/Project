"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ko } from "date-fns/locale";
import { Plus, Download, Trash2, Image as ImageIcon, FolderPlus } from "lucide-react";
import type { MediaItem } from "@/lib/types";
import MediaThumb from "@/components/MediaThumb";
import Lightbox from "@/components/Lightbox";
import AlbumPickerSheet from "@/components/AlbumPickerSheet";
import { uploadFiles } from "@/lib/uploadMedia";

type ViewMode = "day" | "month" | "year";

function groupLabel(ts: number, mode: ViewMode) {
  const d = new Date(ts);
  if (mode === "year") return format(d, "yyyy년", { locale: ko });
  if (mode === "month") return format(d, "yyyy년 M월", { locale: ko });
  if (isToday(d)) return "오늘";
  if (isYesterday(d)) return "어제";
  return format(d, "yyyy년 M월 d일 (EEE)", { locale: ko });
}

const gridColsByMode: Record<ViewMode, string> = {
  day: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8",
  month: "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
  year: "grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12",
};

type Props = {
  filterAlbum?: string;
  filterLiked?: boolean;
};

type UserOption = { id: string; displayName: string };

export default function Timeline({ filterAlbum, filterLiked }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [uploaderFilter, setUploaderFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<{ user: { id: string } | null }>)
      .then((d) => d.user && setCurrentUserId(d.user.id));
    fetch("/api/users")
      .then((r) => r.json() as Promise<{ users: UserOption[] }>)
      .then((d) => setUsers(d.users ?? []));
  }, []);

  // 업로드 도중 탭을 닫거나 새로고침하려 하면 한 번 경고 (앱 전환 자체는 브라우저 API로 막을 수 없음)
  useEffect(() => {
    if (!uploadProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploadProgress]);

  const query = useCallback(
    (after?: string | null) => {
      const params = new URLSearchParams();
      if (after) params.set("cursor", after);
      if (filterAlbum) params.set("album", filterAlbum);
      if (filterLiked) params.set("liked", "1");
      if (uploaderFilter) params.set("uploader", uploaderFilter);
      return `/api/media?${params.toString()}`;
    },
    [filterAlbum, filterLiked, uploaderFilter]
  );

  const load = useCallback(
    async (after?: string | null) => {
      setLoading(true);
      const res = await fetch(query(after));
      const data = (await res.json()) as { items: MediaItem[]; nextCursor: string | null };
      setItems((prev) => (after ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor);
      setLoading(false);
    },
    [query]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트/필터 변경 시 최초 로드
    load(null);
  }, [load]);

  const uploaderSegments = [
    { id: null as string | null, label: "전체" },
    ...users.map((u) => ({ id: u.id, label: u.id === currentUserId ? "나" : u.displayName })),
  ];

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  function toggleSelectGroup(groupItems: MediaItem[]) {
    setSelected((prev) => {
      const ids = groupItems.map((i) => i.id);
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function onThumbClick(index: number) {
    const item = items[index];
    if (selectMode) {
      toggleSelect(item.id);
    } else {
      setLightboxIndex(index);
    }
  }

  async function handleBulkDelete() {
    if (!selected.size) return;
    if (!confirm(`${selected.size}개 항목을 삭제할까요?`)) return;
    const ids = Array.from(selected);
    await fetch("/api/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    setSelected(new Set());
    setSelectMode(false);
  }

  async function handleBulkDownload() {
    if (!selected.size) return;
    const ids = Array.from(selected);
    const res = await fetch("/api/media/zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      alert("다운로드에 실패했습니다.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "shared-album.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleAlbumPickerDone() {
    setShowAlbumPicker(false);
    setSelected(new Set());
    setSelectMode(false);
  }

  async function handleSingleDelete(id: string) {
    await fetch("/api/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setLightboxIndex(null);
  }

  async function handleToggleLike(id: string) {
    const res = await fetch(`/api/media/${id}/like`, { method: "POST" });
    const data = (await res.json()) as { likedAt: number | null };
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, likedAt: data.likedAt } : i)));
  }

  function onFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) setPendingFiles(files);
    e.target.value = "";
  }

  async function startUpload() {
    if (!pendingFiles?.length) return;
    setUploadProgress({ done: 0, total: pendingFiles.length });
    const { errors } = await uploadFiles(pendingFiles, (done, total) =>
      setUploadProgress({ done, total })
    );
    setUploadProgress(null);
    setPendingFiles(null);
    if (errors.length) alert(`일부 업로드 실패:\n${errors.join("\n")}`);
    setItems([]);
    setCursor(null);
    load(null);
  }

  const groups: { label: string; items: MediaItem[] }[] = [];
  for (const item of items) {
    const label = groupLabel(item.takenAt, viewMode);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={() => {
            setSelectMode((v) => !v);
            setSelected(new Set());
          }}
          className="tap-scale text-[15px] font-medium text-accent"
        >
          {selectMode ? "취소" : "선택"}
        </button>

        {selectMode ? (
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-muted">{selected.size}개 선택됨</span>
            <button
              onClick={toggleSelectAll}
              className="tap-scale text-[15px] font-medium text-accent"
            >
              {selected.size === items.length && items.length > 0 ? "전체 해제" : "전체 선택"}
            </button>
          </div>
        ) : (
          users.length >= 1 && (
            <div className="glass flex gap-0.5 rounded-full p-0.5">
              {uploaderSegments.map((seg) => (
                <button
                  key={seg.id ?? "all"}
                  onClick={() => setUploaderFilter(seg.id)}
                  className={`tap-scale rounded-full px-3 py-1 text-[13px] font-medium ${
                    uploaderFilter === seg.id ? "bg-accent text-white" : "text-muted"
                  }`}
                >
                  {seg.label}
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {!selectMode && (
        <div className="flex justify-end px-4 pb-2">
          <div className="glass flex gap-0.5 rounded-full p-0.5">
            {(
              [
                ["day", "일"],
                ["month", "월"],
                ["year", "년"],
              ] as [ViewMode, string][]
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`tap-scale rounded-full px-3 py-1 text-[13px] font-medium ${
                  viewMode === mode ? "bg-accent text-white" : "text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-24 md:pb-10">
        {groups.map((group) => {
          const groupIds = group.items.map((i) => i.id);
          const groupAllSelected = groupIds.every((id) => selected.has(id));
          return (
          <div key={group.label}>
            <div className="flex items-center justify-between px-4 pb-1.5 pt-3">
              <h2 className="text-[13px] font-semibold text-muted">{group.label}</h2>
              {selectMode && (
                <button
                  onClick={() => toggleSelectGroup(group.items)}
                  className="tap-scale text-[12px] font-medium text-accent"
                >
                  {groupAllSelected ? "선택 해제" : "전체 선택"}
                </button>
              )}
            </div>
            <div className={`grid gap-0.5 px-0.5 ${gridColsByMode[viewMode]}`}>
              {group.items.map((item) => {
                const globalIndex = items.indexOf(item);
                return (
                  <MediaThumb
                    key={item.id}
                    item={item}
                    selectMode={selectMode}
                    selected={selected.has(item.id)}
                    isMine={item.ownerId === currentUserId}
                    showUploader={users.length > 1}
                    onClick={() => onThumbClick(globalIndex)}
                  />
                );
              })}
            </div>
          </div>
          );
        })}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-24 text-center text-muted">
            <ImageIcon className="h-10 w-10" strokeWidth={1.3} />
            <p className="text-[15px]">아직 사진이나 동영상이 없어요.</p>
            <p className="text-[13px]">오른쪽 아래 + 버튼으로 첫 추억을 올려보세요.</p>
          </div>
        )}

        {cursor && (
          <div className="flex justify-center py-4">
            <button
              onClick={() => load(cursor)}
              disabled={loading}
              className="tap-scale rounded-full bg-surface px-4 py-2 text-[13px] text-muted"
            >
              {loading ? "불러오는 중..." : "더 보기"}
            </button>
          </div>
        )}
      </div>

      {selectMode && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4 md:bottom-6">
          <div className="glass flex items-center gap-1 rounded-full px-2 py-1.5">
            <button
              onClick={() => setShowAlbumPicker(true)}
              className="tap-scale flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-medium text-accent"
            >
              <FolderPlus className="h-[17px] w-[17px]" strokeWidth={2} />
              앨범
            </button>
            <button
              onClick={handleBulkDownload}
              className="tap-scale flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-medium text-accent"
            >
              <Download className="h-[17px] w-[17px]" strokeWidth={2} />
              다운로드
            </button>
            <button
              onClick={handleBulkDelete}
              className="tap-scale flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-medium text-danger"
            >
              <Trash2 className="h-[17px] w-[17px]" strokeWidth={2} />
              삭제
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={onFilesChosen}
      />
      {!selectMode && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="tap-scale fixed bottom-24 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_16px_rgba(0,122,255,0.45)] ring-1 ring-white/20 safe-bottom md:bottom-6 md:right-6"
          aria-label="사진/동영상 업로드"
        >
          <Plus className="h-6 w-6" strokeWidth={2.4} />
        </button>
      )}

      {pendingFiles && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-sm rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-[28px] sm:pb-5">
            <div className="sheet-handle sm:hidden" />
            {uploadProgress ? (
              <>
                <h3 className="mb-4 text-[17px] font-semibold">업로드 중...</h3>
                <div className="mb-2">
                  <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{
                        width: `${(uploadProgress.done / uploadProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[13px] text-muted">
                    {uploadProgress.done} / {uploadProgress.total}
                  </p>
                </div>
                <p className="rounded-[10px] bg-danger/10 px-3 py-2 text-[12px] text-danger">
                  업로드가 끝날 때까지 이 화면을 벗어나지 마세요. 특히 아이폰은 다른 앱으로
                  전환하면 업로드가 중간에 끊길 수 있어요.
                </p>
              </>
            ) : (
              <>
                <h3 className="mb-5 text-[17px] font-semibold">
                  {pendingFiles.length}개 항목을 업로드할까요?
                </h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPendingFiles(null)}
                    className="tap-scale flex-1 rounded-[14px] bg-background py-3 text-[15px] font-medium text-foreground"
                  >
                    취소
                  </button>
                  <button
                    onClick={startUpload}
                    className="tap-scale flex-1 rounded-[14px] bg-accent py-3 text-[15px] font-semibold text-white"
                  >
                    업로드
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showAlbumPicker && (
        <AlbumPickerSheet
          mediaIds={Array.from(selected)}
          onClose={() => setShowAlbumPicker(false)}
          onDone={handleAlbumPickerDone}
        />
      )}

      {lightboxIndex !== null && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onDelete={handleSingleDelete}
          onToggleLike={handleToggleLike}
        />
      )}
    </div>
  );
}
