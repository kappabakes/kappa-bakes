import { NextResponse } from "next/server";
import { db } from "@/lib/stock";
import {
  hashCode,
  createSession,
  SESSION_COOKIE,
  cookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { code } = (await req.json()) as { code: string };

  // Whichever address it went to — the code itself is the proof.
  const record = await db.adminCode.findFirst({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record)
    return NextResponse.json(
      { error: "That code has expired. Send yourself a new one." },
      { status: 400 }
    );

  // Five guesses, then the code dies. Six digits is only a million options.
  if (record.attempts >= 5) {
    await db.adminCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return NextResponse.json(
      { error: "Too many attempts. Send yourself a new code." },
      { status: 429 }
    );
  }

  if (record.codeHash !== hashCode((code ?? "").trim())) {
    await db.adminCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "That code isn't right." }, { status: 400 });
  }

  await db.adminCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  const res = NextResponse.json({ ok: true, email: record.email });
  res.cookies.set(SESSION_COOKIE, createSession(record.email), cookieOptions);
  return res;
}
