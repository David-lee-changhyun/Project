"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImageIcon, LayoutGrid, CalendarDays } from "lucide-react";

const tabs = [
  { href: "/", label: "타임라인", Icon: ImageIcon },
  { href: "/albums", label: "앨범", Icon: LayoutGrid },
  { href: "/calendar", label: "캘린더", Icon: CalendarDays },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 hairline-t bg-surface-elevated backdrop-blur-xl safe-bottom">
      <div className="mx-auto flex max-w-2xl">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`tap-scale flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon
                className="h-[26px] w-[26px]"
                strokeWidth={active ? 2.2 : 1.8}
                fill={active ? "currentColor" : "none"}
                fillOpacity={active ? 0.12 : 0}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
