"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/config";

/**
 * "Orders close in 1d 3h 20m". Ticks every 30 seconds — the minute is the
 * smallest unit shown, so anything faster is wasted work.
 */
export function Countdown({
  cutoffIso,
  onExpire,
}: {
  cutoffIso: string;
  onExpire?: () => void;
}) {
  const [left, setLeft] = useState(
    () => new Date(cutoffIso).getTime() - Date.now()
  );

  useEffect(() => {
    const tick = () => {
      const ms = new Date(cutoffIso).getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0) onExpire?.();
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [cutoffIso, onExpire]);

  if (left <= 0)
    return <span className="text-bad">Orders closed</span>;

  // Under six hours it stops being background information.
  const urgent = left < 6 * 3_600_000;

  return (
    <span className={urgent ? "text-bad" : "text-gold"}>
      Orders close in {countdown(left)}
    </span>
  );
}
