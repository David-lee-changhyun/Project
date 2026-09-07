"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Timeline from "@/components/Timeline";

type Chip = { name: string; count: number };

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
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={() => router.push("/albums")} className="text-accent-2">
            ‹ 앨범
          </button>
          <h2 className="font-semibold">{tag ? `#${tag}` : location}</h2>
        </div>
        <Timeline filterTag={tag ?? undefined} filterLocation={location ?? undefined} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">태그</h2>
        {tags.length === 0 ? (
          <p className="text-sm text-muted">아직 태그가 없어요. 업로드할 때 태그를 추가해보세요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button
                key={t.name}
                onClick={() => router.push(`/albums?tag=${encodeURIComponent(t.name)}`)}
                className="rounded-full bg-surface px-4 py-2 text-sm ring-1 ring-border"
              >
                #{t.name} <span className="text-muted">{t.count}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">장소</h2>
        {locations.length === 0 ? (
          <p className="text-sm text-muted">아직 장소 정보가 없어요.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {locations.map((l) => (
              <button
                key={l.name}
                onClick={() => router.push(`/albums?location=${encodeURIComponent(l.name)}`)}
                className="rounded-full bg-surface px-4 py-2 text-sm ring-1 ring-border"
              >
                📍 {l.name} <span className="text-muted">{l.count}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
