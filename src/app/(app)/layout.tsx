import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <Sidebar displayName={user.displayName} />

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between hairline-b bg-surface-elevated px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
          <h1 className="text-[19px] font-semibold tracking-tight">우리 앨범</h1>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-muted">{user.displayName}</span>
            <Link href="/settings" aria-label="설정" className="tap-scale text-muted">
              <Settings className="h-5 w-5" strokeWidth={1.8} />
            </Link>
          </div>
        </header>
        <main className="flex w-full flex-1 flex-col">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
