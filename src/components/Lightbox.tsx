"use client";

import { useEffect, useCallback } from "react";
import { X, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaItem } from "@/lib/types";

const iconBtn = "glass-dark tap-scale flex h-9 w-9 items-center justify-center rounded-full text-white";

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
        <button onClick={onClose} className={iconBtn} aria-label="닫기">
          <X className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>
        <div className="text-center text-[12px] leading-tight text-white/65">
          <div>{new Date(item.takenAt).toLocaleString("ko-KR")}</div>
          <div>
            {item.ownerName}
            {item.locationName ? ` · ${item.locationName}` : ""}
          </div>
        </div>
        <div className="flex gap-2.5">
          <a href={`${src}?download=1`} className={iconBtn} aria-label="다운로드">
            <Download className="h-[18px] w-[18px]" strokeWidth={2} />
          </a>
          <button
            onClick={() => {
              if (confirm("이 항목을 삭제할까요?")) onDelete(item.id);
            }}
            className={iconBtn}
            aria-label="삭제"
          >
            <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {index > 0 && (
          <button onClick={prev} className={`absolute left-2 z-10 ${iconBtn}`} aria-label="이전">
            <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
        )}
        {item.type === "video" ? (
          <video src={src} controls autoPlay className="max-h-full max-w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="max-h-full max-w-full object-contain" />
        )}
        {index < items.length - 1 && (
          <button onClick={next} className={`absolute right-2 z-10 ${iconBtn}`} aria-label="다음">
            <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
          </button>
        )}
      </div>

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {item.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-white/12 px-3 py-1 text-[12px] text-white/90"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
