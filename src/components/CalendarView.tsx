"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  differenceInCalendarDays,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  getDay,
  isToday,
  isSameMonth,
} from "date-fns";
import { ko } from "date-fns/locale";
import { Heart, CalendarDays, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/lib/types";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

// 사진 달력: 달마다 날짜별 업로드 개수를 가벼운 API 하나로 받아와서 뱃지로 표시.
// 사진 원본은 전혀 안 가져오고, 타임스탬프 그룹핑도 브라우저(로컬 시간대)에서
// 하기 때문에 사진이 아무리 많아도 이 화면 자체는 항상 가벼움
function PhotoCalendar() {
  const router = useRouter();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const from = month.getTime();
    const to = addMonths(month, 1).getTime();
    let cancelled = false;
    fetch(`/api/media/day-counts?from=${from}&to=${to}`)
      .then((r) => r.json() as Promise<{ takenAts: number[] }>)
      .then((d) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const ts of d.takenAts ?? []) {
          const key = dayKey(new Date(ts));
          next[key] = (next[key] ?? 0) + 1;
        }
        setCounts(next);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const all = eachDayOfInterval({ start, end });
    // 1일이 무슨 요일이든 첫 주 앞을 비워서 요일 줄을 맞춤
    const leadingBlanks = Array.from({ length: getDay(start) }, () => null);
    return [...leadingBlanks, ...all];
  }, [month]);

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">사진 달력</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            aria-label="이전 달"
            className="tap-scale flex h-7 w-7 items-center justify-center rounded-full text-muted"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.2} />
          </button>
          <span className="min-w-[76px] text-center text-[13px] font-medium text-foreground">
            {format(month, "yyyy년 M월", { locale: ko })}
          </span>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="다음 달"
            className="tap-scale flex h-7 w-7 items-center justify-center rounded-full text-muted"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] bg-surface p-2">
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-1 text-center text-[11px] font-medium text-muted-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((d, i) => {
            if (!d) return <div key={`b${i}`} />;
            const key = dayKey(d);
            const count = counts[key] ?? 0;
            return (
              <button
                key={key}
                disabled={count === 0}
                onClick={() => router.push(`/?date=${key}`)}
                className="tap-scale flex flex-col items-center gap-0.5 py-1 disabled:opacity-100"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] ${
                    isToday(d)
                      ? "bg-accent font-semibold text-white"
                      : isSameMonth(d, month)
                        ? "text-foreground"
                        : "text-muted-2"
                  }`}
                >
                  {format(d, "d")}
                </span>
                <span
                  className={`text-[9px] font-semibold leading-none ${
                    count > 0 ? "text-accent" : "text-transparent"
                  }`}
                >
                  {count > 0 ? count : "·"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

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

      <PhotoCalendar />

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
          <form
            onSubmit={addEvent}
            className="w-full max-w-sm rounded-t-[28px] bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-[28px] sm:pb-5"
          >
            <div className="sheet-handle sm:hidden" />
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
