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
    <nav className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-6 md:hidden">
      <div className="glass flex w-full max-w-[340px] justify-around rounded-full px-2 py-2">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`tap-scale flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-medium ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon
                className="h-[23px] w-[23px]"
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
