"use client";

import { useEffect, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ko } from "date-fns/locale";
import { Heart, CalendarDays, Plus, X } from "lucide-react";
import type { CalendarEvent } from "@/lib/types";

function nextOccurrence(eventDate: number, repeatYearly: boolean) {
  const original = new Date(eventDate);
  if (!repeatYearly) return original;
  const now = new Date();
  const candidate = new Date(now.getFullYear(), original.getMonth(), original.getDate());
  if (differenceInCalendarDays(candidate, now) < 0) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate;
}

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState<"anniversary" | "event">("event");
  const [memo, setMemo] = useState("");

  function load() {
    fetch("/api/calendar")
      .then((r) => r.json() as Promise<{ events: CalendarEvent[] }>)
      .then((d) => setEvents(d.events ?? []));
  }

  useEffect(load, []);

  const anniversaries = events.filter((e) => e.kind === "anniversary");
  const primary = anniversaries.sort((a, b) => a.eventDate - b.eventDate)[0];
  const daysSince = primary
    ? differenceInCalendarDays(new Date(), new Date(primary.eventDate)) + 1
    : null;

  const upcoming = [...events]
    .map((e) => ({ e, next: nextOccurrence(e.eventDate, !!e.repeatYearly || e.kind === "anniversary") }))
    .sort((a, b) => a.next.getTime() - b.next.getTime());

  async function addEvent(ev: React.FormEvent) {
    ev.preventDefault();
    if (!title || !date) return;
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        eventDate: new Date(date).getTime(),
        kind,
        memo: memo || undefined,
      }),
    });
    setShowForm(false);
    setTitle("");
    setDate("");
    setMemo("");
    setKind("event");
    load();
  }

  async function deleteEvent(id: string) {
    if (!confirm("삭제할까요?")) return;
    await fetch(`/api/calendar/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4 md:py-8">
      {primary && (
        <div className="mb-7 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#ffe3ec] to-[#f1e3ff] p-6 text-center">
          <div className="mb-2 flex justify-center text-[20px]">🩷</div>
          <p className="text-[13px] font-medium text-[#b3618c]">{primary.title}</p>
          <p className="mt-1 text-[38px] font-bold leading-none tracking-tight text-accent-pink-deep">
            D+{daysSince}
          </p>
          <p className="mt-2 text-[12px] text-[#c98ba8]">
            {format(new Date(primary.eventDate), "yyyy년 M월 d일", { locale: ko })}부터
          </p>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          우리의 일정
        </h2>
        <button
          onClick={() => setShowForm(true)}
          className="tap-scale flex items-center gap-1 text-[14px] font-medium text-accent"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          추가
        </button>
      </div>

      {upcoming.length === 0 ? (
        <p className="px-1 py-6 text-[14px] text-muted">등록된 일정이 없어요.</p>
      ) : (
        <div className="overflow-hidden rounded-[14px] bg-surface">
          {upcoming.map(({ e, next }, i) => {
            const dday = differenceInCalendarDays(next, new Date());
            const Icon = e.kind === "anniversary" ? Heart : CalendarDays;
            return (
              <div
                key={e.id}
                className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "hairline-t" : ""}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    e.kind === "anniversary" ? "bg-accent-pink/12 text-accent-pink" : "bg-accent/12 text-accent"
                  }`}
                >
                  <Icon
                    className="h-4 w-4"
                    strokeWidth={2}
                    fill={e.kind === "anniversary" ? "currentColor" : "none"}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-foreground">{e.title}</p>
                  <p className="truncate text-[12px] text-muted">
                    {format(new Date(e.eventDate), "yyyy년 M월 d일", { locale: ko })}
                    {e.memo ? ` · ${e.memo}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[14px] font-semibold text-accent">
                  {dday === 0 ? "D-Day" : dday > 0 ? `D-${dday}` : `D+${-dday}`}
                </span>
                <button
                  onClick={() => deleteEvent(e.id)}
                  aria-label="삭제"
                  className="tap-scale shrink-0 text-muted-2"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
          <form
            onSubmit={addEvent}
            className="w-full max-w-sm rounded-t-[20px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-[20px] sm:pb-5"
          >
            <h3 className="mb-4 text-[17px] font-semibold">일정 추가</h3>
            <div className="mb-5 overflow-hidden rounded-[14px]">
              <input
                className="w-full bg-background px-4 py-3 text-[15px] outline-none"
                placeholder="제목 (예: 처음 만난 날)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <div className="hairline-t">
                <input
                  type="date"
                  className="w-full bg-background px-4 py-3 text-[15px] outline-none"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="hairline-t">
                <select
                  className="w-full bg-background px-4 py-3 text-[15px] outline-none"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as "anniversary" | "event")}
                >
                  <option value="event">일회성 일정</option>
                  <option value="anniversary">기념일 (매년 반복 + D-day)</option>
                </select>
              </div>
              <div className="hairline-t">
                <input
                  className="w-full bg-background px-4 py-3 text-[15px] outline-none"
                  placeholder="메모 (선택)"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="tap-scale flex-1 rounded-[14px] bg-background py-3 text-[15px] font-medium text-foreground"
              >
                취소
              </button>
              <button
                type="submit"
                className="tap-scale flex-1 rounded-[14px] bg-accent py-3 text-[15px] font-semibold text-white"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
