"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, Video } from "lucide-react";
import { formatBytes } from "@/lib/format";

type OwnerStat = { ownerId: string; ownerName: string; count: number; bytes: number };
type Bucket = { totalCount: number; totalBytes: number; byOwner: OwnerStat[] };
type Stats = { photo: Bucket; video: Bucket };

const barColors = ["bg-accent", "bg-accent-pink-deep", "bg-muted-2"];

function Row({
  icon: Icon,
  label,
  bucket,
  currentUserId,
}: {
  icon: typeof ImageIcon;
  label: string;
  bucket: Bucket;
  currentUserId: string | null;
}) {
  const owners = [...bucket.byOwner].sort((a, b) =>
    a.ownerId === currentUserId ? -1 : b.ownerId === currentUserId ? 1 : 0
  );

  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
          <Icon className="h-3.5 w-3.5 text-muted" strokeWidth={2} />
          {label} {bucket.totalCount}개
        </div>
        <span className="text-[12px] text-muted">{formatBytes(bucket.totalBytes)}</span>
      </div>

      {bucket.totalCount === 0 ? (
        <div className="h-1.5 w-full rounded-full bg-border" />
      ) : (
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border">
          {owners.map((o, i) => (
            <div
              key={o.ownerId}
              className={barColors[i % barColors.length]}
              style={{ width: `${(o.count / bucket.totalCount) * 100}%` }}
            />
          ))}
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted">
        {owners.map((o) => (
          <span key={o.ownerId}>
            {o.ownerId === currentUserId ? "나" : o.ownerName} {o.count}개
          </span>
        ))}
        {owners.length === 0 && <span>아직 없음</span>}
      </div>
    </div>
  );
}

export default function StatsBar({ currentUserId }: { currentUserId: string | null }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/media/stats")
      .then((r) => r.json() as Promise<Stats>)
      .then(setStats);
  }, []);

  if (!stats) return null;

  return (
    <section className="rounded-[14px] bg-surface px-4 py-4">
      <Row icon={ImageIcon} label="사진" bucket={stats.photo} currentUserId={currentUserId} />
      <Row icon={Video} label="동영상" bucket={stats.video} currentUserId={currentUserId} />
    </section>
  );
}
