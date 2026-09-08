"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image as ImageIcon, LayoutGrid, CalendarDays, Settings } from "lucide-react";

const tabs = [
  { href: "/", label: "타임라인", Icon: ImageIcon },
  { href: "/albums", label: "앨범", Icon: LayoutGrid },
  { href: "/calendar", label: "캘린더", Icon: CalendarDays },
  { href: "/settings", label: "설정", Icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-6 md:hidden">
      <div className="glass flex items-center gap-1 rounded-full px-2.5 py-2">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`tap-scale flex items-center justify-center rounded-full px-3.5 py-1.5 ${
                active ? "bg-accent/12 text-accent" : "text-muted"
              }`}
            >
              <Icon className="h-[23px] w-[23px]" strokeWidth={active ? 2.2 : 1.8} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
