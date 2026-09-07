"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { X, Download, Trash2, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import type { MediaItem } from "@/lib/types";

const SWIPE_THRESHOLD = 50;

const iconBtn = "glass-dark tap-scale flex h-9 w-9 items-center justify-center rounded-full text-white";

export default function Lightbox({
  items,
  index,
  onClose,
  onIndexChange,
  onDelete,
  onToggleLike,
}: {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  onDelete: (id: string) => void;
  onToggleLike: (id: string) => void;
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

  // 옆 사진을 미리 받아둬서 스와이프/화살표로 넘길 때 딜레이 없이 바로 보이게 함
  useEffect(() => {
    for (const i of [index - 1, index + 1]) {
      const neighbor = items[i];
      if (neighbor?.type === "photo") {
        const img = new window.Image();
        img.src = `/api/media/${neighbor.id}/file`;
      }
    }
  }, [index, items]);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [loadedForId, setLoadedForId] = useState<string | undefined>(item?.id);
  if (item?.id !== loadedForId) {
    setLoadedForId(item?.id);
    setImgLoaded(false);
  }

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaX.current = 0;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = touchDeltaX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) next();
    else prev();
  }

  if (!item) return null;
  const src = `/api/media/${item.id}/file`;
  const liked = !!item.likedAt;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black safe-top safe-bottom">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onClose} className={iconBtn} aria-label="닫기">
          <X className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>
        <div className="text-center text-[12px] leading-tight text-white/65">
          <div>{new Date(item.takenAt).toLocaleString("ko-KR")}</div>
          <div>{item.ownerName}</div>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => onToggleLike(item.id)}
            className={iconBtn}
            aria-label={liked ? "좋아요 취소" : "좋아요"}
          >
            <Heart
              className={`h-[18px] w-[18px] ${liked ? "text-accent-pink" : ""}`}
              fill={liked ? "currentColor" : "none"}
              strokeWidth={2}
            />
          </button>
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

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {index > 0 && (
          <button onClick={prev} className={`absolute left-2 z-10 ${iconBtn}`} aria-label="이전">
            <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
        )}
        {item.type === "video" ? (
          <video src={src} controls autoPlay className="max-h-full max-w-full" />
        ) : (
          <>
            {/* 그리드에서 이미 캐시돼있는 썸네일을 먼저 보여줘서 원본 로딩 딜레이를 안 느끼게 함 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${src}?thumb=1`}
              alt=""
              className={`absolute max-h-full max-w-full scale-105 object-contain blur-md transition-opacity duration-150 ${
                imgLoaded ? "opacity-0" : "opacity-100"
              }`}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              onLoad={() => setImgLoaded(true)}
              className={`max-h-full max-w-full object-contain transition-opacity duration-150 ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        )}
        {index < items.length - 1 && (
          <button onClick={next} className={`absolute right-2 z-10 ${iconBtn}`} aria-label="다음">
            <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );
}
