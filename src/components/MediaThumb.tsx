"use client";

import type { MediaItem } from "@/lib/types";

export default function MediaThumb({
  item,
  selected,
  selectMode,
  onClick,
}: {
  item: MediaItem;
  selected: boolean;
  selectMode: boolean;
  onClick: () => void;
}) {
  const src = `/api/media/${item.id}/file`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative aspect-square w-full overflow-hidden bg-border"
    >
      {item.type === "video" ? (
        <video src={src} className="h-full w-full object-cover" preload="metadata" muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      )}

      {item.type === "video" && (
        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">
          ▶ 동영상
        </span>
      )}

      {selectMode && (
        <span
          className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
            selected
              ? "border-accent-2 bg-accent-2 text-white"
              : "border-white/90 bg-black/20 text-transparent"
          }`}
        >
          ✓
        </span>
      )}

      {selectMode && selected && (
        <span className="absolute inset-0 bg-accent-2/25" />
      )}
    </button>
  );
}
