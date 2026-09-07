"use client";

import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/format";

type DupItem = {
  id: string;
  type: "photo" | "video";
  takenAt: number;
  sizeBytes: number;
  ownerId: string;
  ownerName: string;
  hasThumbnail: boolean;
};
type Group = { hash: string; items: DupItem[] };

export default function DuplicatesView() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [keepByHash, setKeepByHash] = useState<Record<string, string>>({});
  const [busyHash, setBusyHash] = useState<string | null>(null);

  function load() {
    fetch("/api/media/duplicates")
      .then((r) => r.json() as Promise<{ groups: Group[] }>)
      .then((d) => {
        setGroups(d.groups);
        setKeepByHash((prev) => {
          const next = { ...prev };
          for (const g of d.groups) {
            if (!next[g.hash]) next[g.hash] = g.items[0].id; // 가장 먼저 찍힌 걸 기본으로 남김
          }
          return next;
        });
      });
  }

  useEffect(load, []);

  async function cleanupGroup(group: Group) {
    const keepId = keepByHash[group.hash];
    const deleteIds = group.items.filter((i) => i.id !== keepId).map((i) => i.id);
    if (!deleteIds.length) return;
    setBusyHash(group.hash);
    await fetch("/api/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: deleteIds }),
    });
    setBusyHash(null);
    setGroups((prev) => prev?.filter((g) => g.hash !== group.hash) ?? null);
  }

  async function cleanupAll() {
    if (!groups?.length) return;
    if (!confirm(`중복 ${groups.length}그룹을 정리할까요? (각 그룹당 1장만 남아요)`)) return;
    const allDeleteIds = groups.flatMap((g) =>
      g.items.filter((i) => i.id !== keepByHash[g.hash]).map((i) => i.id)
    );
    await fetch("/api/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: allDeleteIds }),
    });
    setGroups([]);
  }

  if (groups === null) return <p className="px-1 py-6 text-[14px] text-muted">불러오는 중...</p>;

  if (groups.length === 0) {
    return <p className="px-1 py-6 text-[14px] text-muted">완전히 동일한 중복 파일이 없어요.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-[13px] text-muted">{groups.length}그룹 발견됨</p>
        <button
          onClick={cleanupAll}
          className="tap-scale flex items-center gap-1 text-[13px] font-medium text-danger"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          전체 정리
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.hash} className="rounded-[14px] bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] text-muted">
                {group.items.length}장 중복 · {formatBytes(group.items[0].sizeBytes)} 각각
              </span>
              <button
                onClick={() => cleanupGroup(group)}
                disabled={busyHash === group.hash}
                className="tap-scale text-[13px] font-medium text-danger disabled:opacity-40"
              >
                이 그룹 정리
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {group.items.map((item) => {
                const keep = keepByHash[group.hash] === item.id;
                const src = `/api/media/${item.id}/file?thumb=1`;
                return (
                  <button
                    key={item.id}
                    onClick={() => setKeepByHash((prev) => ({ ...prev, [group.hash]: item.id }))}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[10px]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <span className={`absolute inset-0 ${keep ? "" : "bg-black/45"}`} />
                    <span
                      className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] ${
                        keep ? "border-accent bg-accent" : "border-white/90 bg-black/20"
                      }`}
                    >
                      {keep && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[9px] text-white">
                      {item.ownerName}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">체크된 사진만 남기고 나머지는 삭제돼요</p>
          </div>
        ))}
      </div>
    </div>
  );
}
