"use client";

import { useEffect, useState } from "react";

/** Animated semicircular gauge for the overall skin score. */
export default function ScoreGauge({
  score,
  size = 240,
}: {
  score: number;
  size?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const stroke = 16;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // Semicircle arc length
  const arc = Math.PI * r;
  const filled = mounted ? (score / 100) * arc : 0;

  const band =
    score >= 80
      ? { label: "Radiant", color: "#2F5D46" }
      : score >= 65
        ? { label: "Healthy, with room to glow", color: "#7A8B3D" }
        : score >= 50
          ? { label: "Needs targeted care", color: "#C4822E" }
          : { label: "Needs attention", color: "#B4654A" };

  // Arc path: from left point over the top to the right point.
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div
      className="relative inline-flex flex-col items-center"
      style={{ width: size }}
      role="img"
      aria-label={`Overall skin score ${score} out of 100 — ${band.label}`}
    >
      <svg width={size} height={size / 2 + stroke} viewBox={`0 0 ${size} ${size / 2 + stroke}`}>
        <path
          d={d}
          fill="none"
          stroke="#E9DFCE"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={d}
          fill="none"
          stroke={band.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc}`}
          strokeDashoffset={arc - filled}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div
        className="absolute inset-x-0 flex flex-col items-center"
        style={{ top: size / 2 - 58 }}
      >
        <span className="font-display text-6xl font-semibold text-ink leading-none">
          {score}
        </span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/50">
          Skin score / 100
        </span>
        <span
          className="mt-2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: `${band.color}1f`, color: band.color }}
        >
          {band.label}
        </span>
      </div>
    </div>
  );
}
