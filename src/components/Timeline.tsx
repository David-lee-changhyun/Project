"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ko } from "date-fns/locale";
import { Plus, Download, Trash2, Image as ImageIcon } from "lucide-react";
import type { MediaItem } from "@/lib/types";
import MediaThumb from "@/components/MediaThumb";
import Lightbox from "@/components/Lightbox";
import { uploadFiles } from "@/lib/uploadMedia";

function groupLabel(ts: number) {
  const d = new Date(ts);
  if (isToday(d)) return "오늘";
  if (isYesterday(d)) return "어제";
  return format(d, "yyyy년 M월 d일 (EEE)", { locale: ko });
}

type Props = {
  filterTag?: string;
  filterLocation?: string;
};

export default function Timeline({ filterTag, filterLocation }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const query = useCallback(
    (after?: string | null) => {
      const params = new URLSearchParams();
      if (after) params.set("cursor", after);
      if (filterTag) params.set("tag", filterTag);
      if (filterLocation) params.set("location", filterLocation);
      return `/api/media?${params.toString()}`;
    },
    [filterTag, filterLocation]
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  async function handleSingleDelete(id: string) {
    await fetch("/api/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setLightboxIndex(null);
  }

  function onFilesChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) setPendingFiles(files);
    e.target.value = "";
  }

  async function startUpload() {
    if (!pendingFiles?.length) return;
    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    setUploadProgress({ done: 0, total: pendingFiles.length });
    const { errors } = await uploadFiles(
      pendingFiles,
      { tags, locationName: locationInput.trim() || undefined },
      (done, total) => setUploadProgress({ done, total })
    );
    setUploadProgress(null);
    setPendingFiles(null);
    setTagInput("");
    setLocationInput("");
    if (errors.length) alert(`일부 업로드 실패:\n${errors.join("\n")}`);
    setItems([]);
    setCursor(null);
    load(null);
  }

  const groups: { label: string; items: MediaItem[] }[] = [];
  for (const item of items) {
    const label = groupLabel(item.takenAt);
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
        {selectMode && (
          <span className="text-[13px] text-muted">{selected.size}개 선택됨</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="px-4 pb-1.5 pt-3 text-[13px] font-semibold text-muted">
              {group.label}
            </h2>
            <div className="grid grid-cols-3 gap-0.5 px-0.5">
              {group.items.map((item) => {
                const globalIndex = items.indexOf(item);
                return (
                  <MediaThumb
                    key={item.id}
                    item={item}
                    selectMode={selectMode}
                    selected={selected.has(item.id)}
                    onClick={() => onThumbClick(globalIndex)}
                  />
                );
              })}
            </div>
          </div>
        ))}

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
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4">
          <div className="flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.15)] ring-1 ring-border backdrop-blur-xl">
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
      <button
        onClick={() => fileInputRef.current?.click()}
        className="tap-scale fixed bottom-20 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_4px_16px_rgba(0,122,255,0.4)] safe-bottom"
        aria-label="사진/동영상 업로드"
      >
        <Plus className="h-6 w-6" strokeWidth={2.4} />
      </button>

      {pendingFiles && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-sm rounded-t-[20px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-[20px] sm:pb-5">
            <h3 className="mb-4 text-[17px] font-semibold">
              {pendingFiles.length}개 업로드
            </h3>
            {uploadProgress ? (
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
            ) : (
              <>
                <div className="mb-5 overflow-hidden rounded-[14px]">
                  <input
                    className="w-full bg-background px-4 py-3 text-[15px] outline-none"
                    placeholder="태그 (쉼표로 구분, 예: 여행,제주도)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                  />
                  <div className="hairline-t">
                    <input
                      className="w-full bg-background px-4 py-3 text-[15px] outline-none"
                      placeholder="장소 (예: 제주도)"
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                    />
                  </div>
                </div>
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

      {lightboxIndex !== null && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onDelete={handleSingleDelete}
        />
      )}
    </div>
  );
}
