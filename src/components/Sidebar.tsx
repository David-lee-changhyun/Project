"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImageIcon, LayoutGrid, CalendarDays, Settings } from "lucide-react";

const tabs = [
  { href: "/", label: "타임라인", Icon: ImageIcon },
  { href: "/albums", label: "앨범", Icon: LayoutGrid },
  { href: "/calendar", label: "캘린더", Icon: CalendarDays },
];

export default function Sidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col hairline-b border-r border-border bg-surface px-3 py-5 md:flex">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#ffe4ec] text-[17px]">
          🧸
        </span>
        <span className="text-[16px] font-semibold tracking-tight">우리 앨범</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`tap-scale flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] font-medium ${
                active ? "bg-accent/12 text-accent" : "text-foreground hover:bg-background"
              }`}
            >
              <Icon
                className="h-[19px] w-[19px]"
                strokeWidth={active ? 2.2 : 1.8}
                fill={active ? "currentColor" : "none"}
                fillOpacity={active ? 0.12 : 0}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center justify-between px-2 pt-4">
        <span className="text-[13px] text-muted">{displayName}</span>
        <Link href="/settings" aria-label="설정" className="tap-scale text-muted">
          <Settings className="h-5 w-5" strokeWidth={1.8} />
        </Link>
      </div>
    </aside>
  );
}
