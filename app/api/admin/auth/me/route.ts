import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const email = currentAdmin();
  return email
    ? NextResponse.json({ signedIn: true, email })
    : NextResponse.json({ signedIn: false }, { status: 401 });
}
