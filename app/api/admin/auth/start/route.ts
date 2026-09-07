import { NextResponse } from "next/server";
import { db } from "@/lib/stock";
import { emailAt, newCode, hashCode, maskEmail } from "@/lib/auth";
import { sendEmail } from "@/lib/notify";
import { SHOP } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Step one: the password, plus which of the known inboxes to send to.
 * The address is never supplied by the browser — only its position in
 * ADMIN_EMAILS — so this can't be pointed at somebody else's inbox.
 */
export async function POST(req: Request) {
  const { password, index } = (await req.json()) as {
    password: string;
    index: number;
  };

  const address = emailAt(Number(index) || 0);
  if (!address)
    return NextResponse.json({ error: "No admin email configured." }, { status: 500 });

  // Wrong password gets the same shape of answer, minus the send.
  if (password !== process.env.ADMIN_PASSWORD)
    return NextResponse.json({
      ok: true,
      sentTo: maskEmail(address),
      message: "If the password is right, a code is on its way.",
    });

  // One live code at a time, across all addresses.
  await db.adminCode.updateMany({
    where: { usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = newCode();
  await db.adminCode.create({
    data: {
      email: address,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });

  // No email provider configured (local development): print the code to the
  // server console instead, or there'd be no way in.
  if (!process.env.RESEND_API_KEY) {
    console.log("\n========================================");
    console.log(`  SIGN-IN CODE: ${code}`);
    console.log(`  for ${address}`);
    console.log("========================================\n");
  }

  await sendEmail(
    address,
    `${code} is your ${SHOP.name} sign-in code`,
    [
      `Your sign-in code is ${code}`,
      "",
      "It works once and expires in 10 minutes.",
      "",
      "If you didn't just try to sign in, someone has your admin password —",
      "change it now.",
    ].join("\n")
  );

  return NextResponse.json({
    ok: true,
    sentTo: maskEmail(address),
    message: "If the password is right, a code is on its way.",
  });
}
