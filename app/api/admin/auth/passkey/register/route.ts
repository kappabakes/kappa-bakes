import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { registrationOptions, verifyRegistration } from "@/lib/passkeys";

export const dynamic = "force-dynamic";

/**
 * Adding a passkey requires being signed in already — it's an extra key to a
 * door you've already opened, not a way in.
 */
export async function GET() {
  const email = currentAdmin();
  if (!email) return new NextResponse("Nope", { status: 401 });
  return NextResponse.json(await registrationOptions(email));
}

export async function POST(req: Request) {
  const email = currentAdmin();
  if (!email) return new NextResponse("Nope", { status: 401 });

  const { response, label } = await req.json();
  const ok = await verifyRegistration(email, response, label ?? "This device");
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "That didn't verify. Try again." }, { status: 400 });
}
