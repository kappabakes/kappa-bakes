import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { currentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Photo upload for the menu. Uses Vercel Blob, so a new flavour needs no
 * deploy — pick a photo on your phone and save.
 *
 * Needs BLOB_READ_WRITE_TOKEN, which Vercel adds when you create a Blob store.
 * Without it, you can still type a path to a file in /public.
 */
export async function POST(req: Request) {
  if (!currentAdmin()) return new NextResponse("Nope", { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return NextResponse.json(
      {
        error:
          "No image storage configured. Create a Blob store in Vercel, or put the file in /public/flavours and type its path.",
      },
      { status: 501 }
    );

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "No file received." }, { status: 400 });

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json(
      { error: "That image is over 5MB. Shrink it and try again." },
      { status: 413 }
    );

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return NextResponse.json(
      { error: "PNG, JPG or WebP only." },
      { status: 415 }
    );

  const blob = await put(`flavours/${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return NextResponse.json({ url: blob.url });
}
