import { NextResponse } from "next/server";
import { ALLERGENS } from "@/lib/config";
import { customAllergens } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** The full list: the 14 regulated ones plus anything you've added. */
export async function GET() {
  const extra = await customAllergens();
  return NextResponse.json({
    allergens: [
      ...ALLERGENS.map((a) => ({ id: a.id, label: a.label, custom: false })),
      ...extra.map((label) => ({ id: label, label, custom: true })),
    ],
  });
}
