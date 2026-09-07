"use client";

import { Play, Check } from "lucide-react";
import type { MediaItem } from "@/lib/types";

export default function MediaThumb({
  item,
  selected,
  selectMode,
  isMine,
  showUploader,
  onClick,
}: {
  item: MediaItem;
  selected: boolean;
  selectMode: boolean;
  isMine: boolean;
  showUploader: boolean;
  onClick: () => void;
}) {
  const src = `/api/media/${item.id}/file`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative aspect-square w-full overflow-hidden bg-muted-2"
    >
      {item.type === "video" ? (
        <video src={src} className="h-full w-full object-cover" preload="metadata" muted />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      )}

      {item.type === "video" && (
        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-0.5 text-white backdrop-blur-sm">
          <Play className="h-3 w-3" fill="white" strokeWidth={0} />
        </span>
      )}

      {showUploader && (
        <span
          className={`absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-1 ring-white/70 ${
            isMine ? "bg-accent" : "bg-accent-pink-deep"
          }`}
          title={item.ownerName}
        >
          {item.ownerName.slice(0, 1)}
        </span>
      )}

      {selectMode && <span className="absolute inset-0 bg-black/10" />}

      {selectMode && (
        <span
          className={`absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] ${
            selected ? "border-accent bg-accent" : "border-white/95 bg-black/15"
          }`}
        >
          {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        </span>
      )}

      {selectMode && selected && <span className="absolute inset-0 ring-2 ring-inset ring-accent" />}
    </button>
  );
}
