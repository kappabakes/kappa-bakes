import { NextResponse } from "next/server";
import { adminEmails, maskEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Which inboxes a code can go to, masked. No password needed — there's nothing
 * useful here, and the sign-in page needs it before anything else happens.
 */
export async function GET() {
  return NextResponse.json({
    options: adminEmails().map((e, index) => ({
      index,
      masked: maskEmail(e),
    })),
  });
}
