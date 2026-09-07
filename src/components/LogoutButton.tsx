"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
      aria-label="로그아웃"
      className="tap-scale text-muted"
    >
      <LogOut className="h-5 w-5" strokeWidth={1.8} />
    </button>
  );
}
