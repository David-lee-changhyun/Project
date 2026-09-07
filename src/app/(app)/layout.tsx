import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
import LogoutButton from "@/components/LogoutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-1 bg-background">
      <Sidebar displayName={user.displayName} />

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between hairline-b bg-surface-elevated px-4 py-3 backdrop-blur-xl safe-top md:hidden">
          <h1 className="text-[17px] font-semibold tracking-tight">우리 앨범</h1>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-muted">{user.displayName}</span>
            <LogoutButton />
          </div>
        </header>
        <main className="flex w-full flex-1 flex-col">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
