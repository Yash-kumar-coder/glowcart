"use client";

import { useMemo } from "react";
import type { SkinAnalysisResult, SkinToneResult } from "@/lib/normalize";
import { buildAdvisorReport } from "@/lib/advisor";
import type { RoutinePick } from "@/lib/recommend";
import type { ShadeMatch } from "@/lib/shades";

/**
 * GlowAdvisor panel: renders the deterministic advisor report built from
 * the user's real measurements (lib/advisor.ts). Distinct deep-green
 * card so it reads as "your advisor" between the data report and the
 * shopping sections.
 */
export default function AdvisorPanel({
  skin,
  tone,
  picks,
  budget,
  matches,
}: {
  skin: SkinAnalysisResult;
  tone: SkinToneResult | null;
  picks: RoutinePick[];
  budget: number;
  matches: ShadeMatch[];
}) {
  const report = useMemo(
    () => buildAdvisorReport({ skin, tone, picks, budget, matches }),
    [skin, tone, picks, budget, matches]
  );

  return (
    <section className="mt-10 rounded-[2rem] bg-forest p-6 text-cream sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blush">
          ✦ GlowAdvisor
        </p>
        <p className="text-xs font-semibold text-cream/55">
          From your numbers. No generic tips.
        </p>
      </div>
      <h2 className="mt-2 font-display text-3xl font-semibold">
        {report.headline}
      </h2>
      <p className="mt-3 max-w-3xl leading-relaxed text-cream/90">
        {report.summary}
      </p>

      {report.shadeNote && (
        <p className="mt-4 max-w-3xl rounded-2xl bg-blush/15 px-4 py-3 text-sm leading-relaxed text-cream/90">
          <strong className="text-blush">Shade note:</strong> {report.shadeNote}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Why each product */}
        <div className="rounded-3xl bg-cream/8 p-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-cream/60">
            Why each product is in your routine
          </h3>
          <ul className="mt-3 space-y-3">
            {report.productReasons.map((r) => (
              <li key={r.productId} className="text-sm leading-relaxed">
                <span className="font-semibold text-cream">{r.productName}</span>
                <span className="text-cream/80"> — {r.reason}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          {/* Budget trade-offs */}
          <div className="rounded-3xl bg-cream/8 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cream/60">
              Budget trade-offs
            </h3>
            <ul className="mt-3 space-y-2">
              {report.budgetNotes.map((note, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-cream/85">
                  <span className="mt-0.5 text-blush" aria-hidden>
                    •
                  </span>
                  {note}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-cream/50">
              Updates when you change the budget.
            </p>
          </div>

          {/* AM / PM usage plan */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-cream/8 p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cream/60">
                <span aria-hidden>☀️</span> Morning plan
              </h3>
              <ol className="mt-3 space-y-2.5">
                {report.plan.am.map((step, i) => (
                  <li key={i} className="text-sm leading-relaxed">
                    <span className="font-semibold text-blush">{i + 1}.</span>{" "}
                    <span className="font-semibold text-cream">{step.productName}</span>
                    <span className="block text-cream/70">{step.instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-3xl bg-cream/8 p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cream/60">
                <span aria-hidden>🌙</span> Evening plan
              </h3>
              <ol className="mt-3 space-y-2.5">
                {report.plan.pm.map((step, i) => (
                  <li key={i} className="text-sm leading-relaxed">
                    <span className="font-semibold text-blush">{i + 1}.</span>{" "}
                    <span className="font-semibold text-cream">{step.productName}</span>
                    <span className="block text-cream/70">{step.instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
