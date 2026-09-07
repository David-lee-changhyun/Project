import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-[#ffe4ec] text-[34px]">
            🧸
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">우리 앨범</h1>
          <p className="mt-1 text-[15px] text-muted">둘만을 위한 프라이빗 공유 앨범</p>
        </div>
        {children}
      </div>
    </div>
  );
}
