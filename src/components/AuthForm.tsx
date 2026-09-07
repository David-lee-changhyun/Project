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

  const rowClass = "w-full bg-surface px-4 py-3 text-[17px] text-foreground outline-none";

  const fields = [
    mode === "signup" && (
      <input
        key="name"
        className={rowClass}
        placeholder="이름 (예: 민준)"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
      />
    ),
    <input
      key="email"
      className={rowClass}
      type="email"
      placeholder="이메일"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      autoComplete="email"
      required
    />,
    <input
      key="password"
      className={rowClass}
      type="password"
      placeholder="비밀번호 (8자 이상)"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      autoComplete={mode === "signup" ? "new-password" : "current-password"}
      minLength={8}
      required
    />,
    mode === "signup" && (
      <input
        key="invite"
        className={rowClass}
        placeholder="초대 코드"
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value)}
      />
    ),
  ].filter(Boolean);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-[14px]">
        {fields.map((field, i) => (
          <div key={i} className={i > 0 ? "hairline-t" : ""}>
            {field}
          </div>
        ))}
      </div>

      {error && <p className="-mt-2 text-center text-[13px] text-danger">{error}</p>}

      <div className="flex flex-col gap-4">
        <button
          type="submit"
          disabled={loading}
          className="tap-scale rounded-[14px] bg-accent py-3.5 text-[17px] font-semibold text-white disabled:opacity-40"
        >
          {loading ? "처리 중..." : mode === "signup" ? "가입하기" : "로그인"}
        </button>
        <a
          href={mode === "signup" ? "/login" : "/signup"}
          className="text-center text-[15px] text-accent"
        >
          {mode === "signup" ? "이미 계정이 있어요" : "처음이신가요? 계정 만들기"}
        </a>
      </div>
    </form>
  );
}
