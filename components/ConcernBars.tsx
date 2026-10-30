"use client";

import { useEffect, useState } from "react";
import type { ConcernScore } from "@/lib/normalize";

function bandFor(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: "Strong", color: "#2F5D46", bg: "#2F5D4614" };
  if (score >= 65) return { label: "Fair", color: "#7A8B3D", bg: "#7A8B3D14" };
  if (score >= 50) return { label: "Needs care", color: "#C4822E", bg: "#C4822E14" };
  return { label: "Needs attention", color: "#B4654A", bg: "#B4654A14" };
}

/** Per-concern score bars, weakest first (input arrives pre-sorted). */
export default function ConcernBars({ concerns }: { concerns: ConcernScore[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="divide-y divide-ink/8">
      {concerns.map((c, i) => {
        const band = bandFor(c.score);
        return (
          <div key={c.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h4 className="font-display text-lg font-semibold text-ink">
                  {c.label}
                </h4>
                {i < 3 && (
                  <span className="rounded-full bg-clay/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-clay">
                    Top concern
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: band.bg, color: band.color }}
                >
                  {band.label}
                </span>
                <span className="font-display text-xl font-semibold text-ink tabular-nums">
                  {c.score}
                </span>
              </div>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full"
                style={{
                  width: mounted ? `${c.score}%` : "0%",
                  backgroundColor: band.color,
                  transition: `width 1s cubic-bezier(0.22, 1, 0.36, 1) ${i * 70}ms`,
                }}
              />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink/65">
              {c.explanation}
            </p>
            {c.score < 70 && (
              <p className="mt-1 text-sm leading-relaxed text-pine">
                <span className="font-semibold">What helps: </span>
                {c.advice}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
