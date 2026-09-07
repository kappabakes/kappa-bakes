import { SLICES_PER_CAKE } from "@/lib/config";

/**
 * A live-looking indicator: green while there's plenty, amber under half,
 * red under a fifth. The pulse is what makes it read as "right now" rather
 * than a number someone typed in.
 */
export function StockDot({
  left,
  capacity,
}: {
  left: number;
  capacity: number;
}) {
  const share = capacity > 0 ? left / capacity : 0;
  const tone =
    left <= 0
      ? "bg-muted"
      : share <= 0.2
        ? "bg-bad"
        : share < 0.5
          ? "bg-warn"
          : "bg-good";

  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
      {left > 0 && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${tone}`}
        />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${tone}`} />
    </span>
  );
}

/**
 * Marks in groups of eight — because that is literally what a day is: cakes of
 * eight slices. Filled marks are sold. The gaps between groups aren't
 * decoration; they're where one cake ends and the next begins.
 */
export function SliceCounter({
  left,
  capacity,
}: {
  left: number;
  capacity: number;
}) {
  const sold = capacity - left;
  const cakes = Math.ceil(capacity / SLICES_PER_CAKE);
  const share = capacity > 0 ? left / capacity : 0;
  const tone =
    share <= 0.2 ? "bg-bad" : share < 0.5 ? "bg-warn" : "bg-gold";

  return (
    <div
      className="flex flex-wrap items-end gap-x-3 gap-y-2"
      role="img"
      aria-label={`${left} of ${capacity} slices left`}
    >
      {Array.from({ length: cakes }, (_, c) => {
        const inThis = Math.min(SLICES_PER_CAKE, capacity - c * SLICES_PER_CAKE);
        return (
          <div key={c} className="flex gap-[3px]">
            {Array.from({ length: inThis }, (_, i) => {
              const isSold = c * SLICES_PER_CAKE + i < sold;
              return (
                <span
                  key={i}
                  className={[
                    "block w-[7px] rounded-[1px] transition-all duration-500",
                    isSold ? "h-3 bg-line" : `h-7 ${tone}`,
                  ].join(" ")}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
