import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { addAllergen, removeAllergen, customAllergens } from "@/lib/settings";

export const dynamic = "force-dynamic";
const authed = () => Boolean(currentAdmin());

export async function GET() {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  return NextResponse.json({ custom: await customAllergens() });
}

/**
 * Adding an allergen puts it on the list for every flavour to choose from.
 * It isn't selected anywhere — you tick it where it applies.
 */
export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const { label } = (await req.json()) as { label: string };
  if (!label?.trim())
    return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  return NextResponse.json({ custom: await addAllergen(label) });
}

export async function DELETE(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const label = new URL(req.url).searchParams.get("label");
  if (!label) return new NextResponse("No label", { status: 400 });
  return NextResponse.json({ custom: await removeAllergen(label) });
}
