"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, ChevronRight } from "lucide-react";
import { isPushSubscribed, isPushSupported, enablePush, disablePush } from "@/lib/push";

export default function SettingsView() {
  const router = useRouter();
  const [supported] = useState(isPushSupported);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isPushSubscribed().then(setEnabled);
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        const res = await enablePush();
        if (res.ok) setEnabled(true);
        else setError(res.error ?? "알림을 켜지 못했어요.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4 md:py-8">
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">알림</h2>
      <div className="overflow-hidden rounded-[14px] bg-surface">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
            <Bell className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-foreground">업로드 알림</p>
            <p className="truncate text-[12px] text-muted">상대방이 사진/동영상을 올리면 알려드려요</p>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            aria-label="업로드 알림 켜기/끄기"
            onClick={toggle}
            disabled={busy || !supported}
            className={`tap-scale relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${
              enabled ? "bg-accent" : "bg-border"
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-[2px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-[20px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>
      </div>
      {!supported && (
        <p className="mt-2 px-1 text-[12px] text-muted">
          이 브라우저(기기)는 알림을 지원하지 않아요. 아이폰은 홈 화면에 추가한 뒤에만 알림을 받을 수 있어요.
        </p>
      )}
      {error && <p className="mt-2 px-1 text-[12px] text-danger">{error}</p>}

      <h2 className="mb-2 mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">계정</h2>
      <div className="overflow-hidden rounded-[14px] bg-surface">
        <button onClick={logout} className="tap-scale flex w-full items-center gap-3 px-4 py-3 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/12 text-danger">
            <LogOut className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="flex-1 text-[15px] text-danger">로그아웃</span>
          <ChevronRight className="h-4 w-4 text-muted-2" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
