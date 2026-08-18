import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { galleryPhotos, setGalleryPhotos } from "@/lib/settings";
import { galleryImages } from "@/lib/gallery";

export const dynamic = "force-dynamic";
const authed = () => Boolean(currentAdmin());

export async function GET() {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const uploaded = await galleryPhotos();
  return NextResponse.json({
    photos: uploaded,
    // What the site is showing right now, which is the folder until you
    // upload your first photo here.
    usingFolder: uploaded.length === 0,
    folderPhotos: galleryImages(),
  });
}

/** Replaces the whole list — that's how ordering and removal are saved too. */
export async function POST(req: Request) {
  if (!authed()) return new NextResponse("Nope", { status: 401 });
  const { photos } = (await req.json()) as { photos: string[] };
  if (!Array.isArray(photos))
    return NextResponse.json({ error: "Expected a list." }, { status: 400 });
  await setGalleryPhotos(photos.filter((p) => typeof p === "string" && p));
  return NextResponse.json({ ok: true, photos: await galleryPhotos() });
}
