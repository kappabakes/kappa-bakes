import { randomBytes } from "crypto";
import { FeedbackScore } from "@prisma/client";
import { WholeItem, normaliseItem } from "./whole";

/** Unguessable, and unique per order. */
export const newSurveyToken = () => randomBytes(16).toString("hex");

/** How each rating reads, and the order they're offered in. */
export const RATINGS: {
  value: FeedbackScore;
  label: string;
  colour: string;
  happy: boolean;
}[] = [
  { value: "LOVED", label: "Loved it", colour: "#1f7a4d", happy: true },
  { value: "REALLY_GOOD", label: "Really good", colour: "#3d8f63", happy: true },
  { value: "GOOD", label: "Good", colour: "#c9a227", happy: true },
  { value: "JUST_OK", label: "Just OK", colour: "#b8763a", happy: false },
  { value: "NOT_GREAT", label: "Not great", colour: "#9d3b3b", happy: false },
];

export const ratingLabel = (r: FeedbackScore) =>
  RATINGS.find((x) => x.value === r)?.label ?? String(r);

export const isHappy = (r: FeedbackScore) =>
  RATINGS.find((x) => x.value === r)?.happy ?? false;

/**
 * The flavours to offer someone, taken from what they actually ordered.
 *
 * Nobody can rate a flavour they didn't have, and a special that's since come
 * off the menu still appears for the people who ate it.
 */
export function flavoursFromSlices(
  slices: { flavour: string }[]
): string[] {
  return [...new Set(slices.map((s) => s.flavour))].sort();
}

/** Halves count as both flavours: they tasted both. */
export function flavoursFromWholeItems(items: WholeItem[]): string[] {
  const out = new Set<string>();
  for (const raw of items) {
    const item = normaliseItem(raw);
    out.add(item.flavour);
    if (item.flavourB) out.add(item.flavourB);
  }
  return [...out].sort();
}
