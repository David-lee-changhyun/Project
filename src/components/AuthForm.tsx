"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup" ? { email, password, displayName, inviteCode } : { email, password }
        ),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "오류가 발생했습니다.");
        return;
      }
      router.replace("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-background px-4 py-3 text-[15px] text-foreground outline-none focus:border-accent-2";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {mode === "signup" && (
        <input
          className={inputClass}
          placeholder="이름 (예: 민준)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
      )}
      <input
        className={inputClass}
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <input
        className={inputClass}
        type="password"
        placeholder="비밀번호 (8자 이상)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        minLength={8}
        required
      />
      {mode === "signup" && (
        <input
          className={inputClass}
          placeholder="초대 코드"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
      )}
      {error && <p className="text-sm text-accent">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="mt-2 rounded-xl bg-accent py-3 text-[15px] font-medium text-white disabled:opacity-50"
      >
        {loading ? "처리 중..." : mode === "signup" ? "가입하기" : "로그인"}
      </button>
      <a
        href={mode === "signup" ? "/login" : "/signup"}
        className="mt-1 text-center text-sm text-accent-2"
      >
        {mode === "signup" ? "이미 계정이 있어요" : "처음이신가요? 계정 만들기"}
      </a>
    </form>
  );
}
