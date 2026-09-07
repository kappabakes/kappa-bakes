import { NextResponse } from "next/server";
import { authenticationOptions, verifyAuthentication } from "@/lib/passkeys";
import {
  createSession,
  SESSION_COOKIE,
  cookieOptions,
  isAdminEmail,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await authenticationOptions());
}

export async function POST(req: Request) {
  const { response } = await req.json();
  const email = await verifyAuthentication(response);

  // A passkey for an address since removed from the allowlist shouldn't work.
  if (!email || !isAdminEmail(email))
    return NextResponse.json(
      { error: "That passkey wasn't recognised." },
      { status: 401 }
    );

  const res = NextResponse.json({ ok: true, email });
  res.cookies.set(SESSION_COOKIE, createSession(email), cookieOptions);
  return res;
}
