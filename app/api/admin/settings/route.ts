import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import {
  maxPerOrder,
  setSetting,
  SETTING_KEYS,
  collectionAddress,
  setCollectionAddress,
} from "@/lib/settings";

export const dynamic = "force-dynamic";
const authed = () => Boolean(currentAdmin());

export async function GET() {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  return NextResponse.json({
    maxPerOrder: await maxPerOrder(),
    collectionAddress: (await collectionAddress()).join("\n"),
  });
}

export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const b = (await req.json()) as {
    maxPerOrder?: number;
    collectionAddress?: string;
  };

  if (b.maxPerOrder !== undefined) {
    const n = Math.floor(Number(b.maxPerOrder));
    if (!Number.isFinite(n) || n < 1 || n > 20)
      return NextResponse.json(
        { error: "Slices per order needs to be between 1 and 20." },
        { status: 400 }
      );
    await setSetting(SETTING_KEYS.maxPerOrder, String(n));
  }

  if (b.collectionAddress !== undefined) {
    if (!b.collectionAddress.trim())
      return NextResponse.json(
        { error: "The collection address can't be empty." },
        { status: 400 }
      );
    await setCollectionAddress(b.collectionAddress);
  }

  return NextResponse.json({
    ok: true,
    maxPerOrder: await maxPerOrder(),
    collectionAddress: (await collectionAddress()).join("\n"),
  });
}
