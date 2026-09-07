import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/stock";
import { collectionAddress } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("No id", { status: 400 });

  const order = await db.wholeOrder.findUnique({ where: { id } });
  if (!order)
    return NextResponse.json({ error: "No such order." }, { status: 404 });

  return NextResponse.json({ order, address: await collectionAddress() });
}
