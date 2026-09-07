import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-2xl">
            💛
          </div>
          <h1 className="text-2xl font-semibold text-foreground">우리 앨범</h1>
          <p className="mt-1 text-sm text-muted">둘만을 위한 프라이빗 공유 앨범</p>
        </div>
        <div className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-border">{children}</div>
      </div>
    </div>
  );
}
