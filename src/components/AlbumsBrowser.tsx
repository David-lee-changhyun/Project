"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Hash, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import Timeline from "@/components/Timeline";

type Chip = { name: string; count: number };

function SectionList({
  title,
  items,
  emptyText,
  Icon,
  onSelect,
}: {
  title: string;
  items: Chip[];
  emptyText: string;
  Icon: typeof Hash;
  onSelect: (name: string) => void;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="px-1 text-[14px] text-muted">{emptyText}</p>
      ) : (
        <div className="overflow-hidden rounded-[14px] bg-surface">
          {items.map((item, i) => (
            <button
              key={item.name}
              onClick={() => onSelect(item.name)}
              className={`tap-scale flex w-full items-center gap-3 px-4 py-3 text-left ${
                i > 0 ? "hairline-t" : ""
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="flex-1 text-[15px] text-foreground">{item.name}</span>
              <span className="text-[13px] text-muted">{item.count}</span>
              <ChevronRight className="h-4 w-4 text-muted-2" strokeWidth={2} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AlbumsBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tag = searchParams.get("tag");
  const location = searchParams.get("location");

  const [tags, setTags] = useState<Chip[]>([]);
  const [locations, setLocations] = useState<Chip[]>([]);

  useEffect(() => {
    if (tag || location) return;
    fetch("/api/media/tags")
      .then((r) => r.json() as Promise<{ tags: Chip[] }>)
      .then((d) => setTags(d.tags ?? []));
    fetch("/api/media/locations")
      .then((r) => r.json() as Promise<{ locations: Chip[] }>)
      .then((d) => setLocations(d.locations ?? []));
  }, [tag, location]);

  if (tag || location) {
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
        <h2 className="px-4 pb-2 text-[22px] font-bold tracking-tight">
          {tag ? `#${tag}` : location}
        </h2>
        <Timeline filterTag={tag ?? undefined} filterLocation={location ?? undefined} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <SectionList
        title="태그"
        items={tags}
        emptyText="아직 태그가 없어요. 업로드할 때 태그를 추가해보세요."
        Icon={Hash}
        onSelect={(name) => router.push(`/albums?tag=${encodeURIComponent(name)}`)}
      />
      <SectionList
        title="장소"
        items={locations}
        emptyText="아직 장소 정보가 없어요."
        Icon={MapPin}
        onSelect={(name) => router.push(`/albums?location=${encodeURIComponent(name)}`)}
      />
    </div>
  );
}
