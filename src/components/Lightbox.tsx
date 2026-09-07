"use client";

import { useEffect, useCallback } from "react";
import type { MediaItem } from "@/lib/types";

export default function Lightbox({
  items,
  index,
  onClose,
  onIndexChange,
  onDelete,
}: {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  onDelete: (id: string) => void;
}) {
  const item = items[index];

  const prev = useCallback(
    () => onIndexChange(Math.max(0, index - 1)),
    [index, onIndexChange]
  );
  const next = useCallback(
    () => onIndexChange(Math.min(items.length - 1, index + 1)),
    [index, items.length, onIndexChange]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  if (!item) return null;
  const src = `/api/media/${item.id}/file`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black safe-top safe-bottom">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onClose} className="text-2xl leading-none">
          ✕
        </button>
        <div className="text-center text-xs text-white/70">
          <div>{new Date(item.takenAt).toLocaleString("ko-KR")}</div>
          {item.locationName && <div>{item.locationName}</div>}
        </div>
        <div className="flex gap-4">
          <a href={`${src}?download=1`} className="text-xl" title="다운로드">
            ⬇️
          </a>
          <button
            onClick={() => {
              if (confirm("이 항목을 삭제할까요?")) onDelete(item.id);
            }}
            className="text-xl"
            title="삭제"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {index > 0 && (
          <button
            onClick={prev}
            className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white"
          >
            ‹
          </button>
        )}
        {item.type === "video" ? (
          <video src={src} controls autoPlay className="max-h-full max-w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="max-h-full max-w-full object-contain" />
        )}
        {index < items.length - 1 && (
          <button
            onClick={next}
            className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white"
          >
            ›
          </button>
        )}
      </div>

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {item.tags.map((t) => (
            <span key={t} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
