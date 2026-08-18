import { db } from "./stock";
import { DEFAULT_MAX_PER_ORDER, SHOP } from "./config";

/** Everything here is changeable from /admin, no deploy needed. */
export const SETTING_KEYS = {
  maxPerOrder: "maxPerOrder",
  customAllergens: "customAllergens",
  collectionAddress: "collectionAddress",
  gallery: "gallery",
} as const;

export async function getSetting(key: string, fallback: string) {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string) {
  await db.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function maxPerOrder(): Promise<number> {
  const raw = await getSetting(
    SETTING_KEYS.maxPerOrder,
    String(DEFAULT_MAX_PER_ORDER)
  );
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_PER_ORDER;
}

/**
 * Allergens you've added yourself. Stored as plain labels and used as their
 * own id, so they display correctly on the menu without a lookup table.
 */
export async function customAllergens(): Promise<string[]> {
  const raw = await getSetting(SETTING_KEYS.customAllergens, "[]");
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function addAllergen(label: string): Promise<string[]> {
  const clean = label.trim();
  if (!clean) return customAllergens();
  const list = await customAllergens();
  if (!list.some((x) => x.toLowerCase() === clean.toLowerCase()))
    list.push(clean);
  await setSetting(SETTING_KEYS.customAllergens, JSON.stringify(list));
  return list;
}

export async function removeAllergen(label: string): Promise<string[]> {
  const list = (await customAllergens()).filter(
    (x) => x.toLowerCase() !== label.trim().toLowerCase()
  );
  await setSetting(SETTING_KEYS.customAllergens, JSON.stringify(list));
  return list;
}

/**
 * Where customers collect from. Editable in the admin, because an address
 * that only lives in code means a house move needs a developer.
 *
 * Used by the confirmation email, the confirmation screen, the tracking page
 * and the order record — so changing it here changes it everywhere at once.
 */
export async function collectionAddress(): Promise<string[]> {
  const raw = await getSetting(
    SETTING_KEYS.collectionAddress,
    SHOP.addressLines.join("\n")
  );
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function setCollectionAddress(lines: string) {
  await setSetting(SETTING_KEYS.collectionAddress, lines.trim());
}

/**
 * Homepage gallery photos, in the order they appear.
 *
 * Stored here rather than read off the filesystem, so a new photo is an
 * upload in the admin rather than a code change and a deploy.
 */
export async function galleryPhotos(): Promise<string[]> {
  const raw = await getSetting(SETTING_KEYS.gallery, "[]");
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function setGalleryPhotos(urls: string[]) {
  await setSetting(SETTING_KEYS.gallery, JSON.stringify(urls.slice(0, 30)));
}
