import { NextResponse } from "next/server";
import { sendReminders, sendWholeReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Emails everyone collecting today, on the morning of collection. Scheduled in
 * vercel.json; can also be triggered by hand from the Orders screen.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const manual = new URL(req.url).searchParams.get("manual") === "true";

  if (!manual && auth !== `Bearer ${process.env.CRON_SECRET}`)
    return new NextResponse("Nope", { status: 401 });

  // Slices and whole cakes are separate lines with separate emails, but
  // they both go out on the morning of collection.
  const [slices, whole] = await Promise.all([
    sendReminders(),
    sendWholeReminders(),
  ]);

  return NextResponse.json({ slices, whole });
}
