import fs from "fs";
import path from "path";

/**
 * Lists whatever is actually in public/gallery, so the gallery shows your
 * photos and nothing else. Add a file and it appears; there are no blank
 * placeholders waiting to be filled.
 *
 * Sorted by filename, so 1.jpg…15.jpg gives you control of the order.
 */
export const GALLERY_LIMIT = 15;

/**
 * The photos to show. Anything uploaded in the admin wins; the folder is the
 * fallback, so a site set up the old way keeps working.
 */
export async function currentGallery(): Promise<string[]> {
  const { galleryPhotos } = await import("./settings");
  const uploaded = await galleryPhotos();
  return uploaded.length > 0 ? uploaded : galleryImages();
}

export function galleryImages(): string[] {
  try {
    const dir = path.join(process.cwd(), "public", "gallery");
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      )
      .slice(0, GALLERY_LIMIT)
      .map((f) => `/gallery/${f}`);
  } catch {
    // Folder missing — no gallery, rather than a broken one.
    return [];
  }
}
