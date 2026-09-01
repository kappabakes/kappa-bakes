import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";

export const dynamic = "force-dynamic";

export async function GET() {
  const email = currentAdmin();
  if (!email) return new NextResponse("Nope", { status: 401 });
  const keys = await db.passkey.findMany({
    where: { email },
    orderBy: { createdAt: "asc" },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true },
  });
  return NextResponse.json({ keys });
}

export async function DELETE(req: Request) {
  const email = currentAdmin();
  if (!email) return new NextResponse("Nope", { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("No id", { status: 400 });
  await db.passkey.deleteMany({ where: { id, email } });
  return NextResponse.json({ ok: true });
}
