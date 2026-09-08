import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { requireUser, AuthError } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }

  const env = await getEnv();
  return NextResponse.json({ publicKey: env.VAPID_PUBLIC_KEY });
}
