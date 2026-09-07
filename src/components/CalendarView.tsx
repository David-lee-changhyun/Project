"use client";

import { useEffect, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ko } from "date-fns/locale";
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
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {primary && (
        <div className="mb-6 rounded-2xl bg-accent p-6 text-center text-white">
          <p className="text-sm opacity-90">{primary.title}</p>
          <p className="mt-1 text-3xl font-bold">D+{daysSince}</p>
          <p className="mt-1 text-xs opacity-80">
            {format(new Date(primary.eventDate), "yyyy년 M월 d일", { locale: ko })}부터
          </p>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">우리의 일정</h2>
        <button onClick={() => setShowForm(true)} className="text-sm text-accent-2">
          + 추가
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {upcoming.map(({ e, next }) => {
          const dday = differenceInCalendarDays(next, new Date());
          return (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 ring-1 ring-border"
            >
              <div>
                <p className="text-sm font-medium">
                  {e.kind === "anniversary" ? "💛 " : "🗓️ "}
                  {e.title}
                </p>
                <p className="text-xs text-muted">
                  {format(new Date(e.eventDate), "yyyy년 M월 d일", { locale: ko })}
                  {e.memo ? ` · ${e.memo}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-accent-2">
                  {dday === 0 ? "D-Day" : dday > 0 ? `D-${dday}` : `D+${-dday}`}
                </span>
                <button onClick={() => deleteEvent(e.id)} className="text-muted">
                  ✕
                </button>
              </div>
            </li>
          );
        })}
        {upcoming.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">등록된 일정이 없어요.</p>
        )}
      </ul>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
          <form
            onSubmit={addEvent}
            className="w-full max-w-sm rounded-t-2xl bg-surface p-5 sm:rounded-2xl"
          >
            <h3 className="mb-3 text-base font-semibold">일정 추가</h3>
            <input
              className="mb-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="제목 (예: 처음 만난 날)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <input
              type="date"
              className="mb-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <select
              className="mb-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as "anniversary" | "event")}
            >
              <option value="event">일회성 일정</option>
              <option value="anniversary">기념일 (매년 반복 + D-day)</option>
            </select>
            <input
              className="mb-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="메모 (선택)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-white"
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
