"use client";

import { useMemo, useState } from "react";
import { CONCERN_META } from "@/lib/normalize";
import { buildRoutineFromConcerns } from "@/lib/recommend";
import RoutineBuilder from "@/components/RoutineBuilder";

const MAX_PICKS = 3;

/**
 * The honest fallback for a photo the AI cannot scan.
 *
 * GlowCart never invents a result: when YouCam can't read a photo, the
 * user can pick their own top concerns instead, and we build the routine
 * from those picks using the exact same catalog matching as the scan
 * path. Nothing here shows a score, a skin age, a shade match or a
 * try-on — those only ever come from a real AI measurement, and this
 * whole view is labeled self-guided so there's no confusion.
 */
export default function ManualRoutine({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [built, setBuilt] = useState(false);
  const [budget, setBudget] = useState(200);

  const picks = useMemo(
    () => (built ? buildRoutineFromConcerns(selected) : []),
    [built, selected]
  );

  const toggle = (id: string) => {
    setBuilt(false);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, id];
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-forest px-3 py-1.5 text-xs font-bold text-cream">
          Self-guided — no AI scan
        </span>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-forest/25 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:border-forest/60"
        >
          ← Back to the AI scan
        </button>
      </div>

      <h1 className="mt-5 font-display text-4xl font-semibold text-forest">
        Tell us what bothers your skin
      </h1>
      <p className="mt-2 max-w-2xl text-ink/65">
        The AI couldn&apos;t read your photo, so we won&apos;t invent a
        score for you. Pick up to {MAX_PICKS} concerns instead — we&apos;ll
        match real products from our catalog to each one, the same way the
        scan path does, and label every pick as yours.
      </p>

      {/* Concern picker */}
      <section className="mt-6 rounded-[2rem] border border-ink/10 bg-white p-6">
        <h2 className="font-display text-2xl font-semibold text-ink">
          Your top concerns
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          Tap to pick — order matters: your first pick gets matched first.{" "}
          {selected.length}/{MAX_PICKS} picked.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(CONCERN_META).map(([id, meta]) => {
            const idx = selected.indexOf(id);
            const active = idx >= 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                aria-pressed={active}
                className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-clay text-white"
                    : "border border-ink/15 text-ink/70 hover:border-forest/50 hover:text-forest"
                }`}
              >
                {active && (
                  <span className="mr-1.5 inline-grid size-5 place-items-center rounded-full bg-white/25 text-[11px] font-bold">
                    {idx + 1}
                  </span>
                )}
                {meta.label}
              </button>
            );
          })}
        </div>

        {selected.length > 0 && !built && (
          <button
            type="button"
            onClick={() => setBuilt(true)}
            className="mt-5 rounded-full bg-clay px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-clay-dark"
          >
            Build my routine →
          </button>
        )}
      </section>

      {built && picks.length > 0 && (
        <>
          {/* What each picked concern means — education, not measurement */}
          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {selected.map((id) => (
              <div
                key={id}
                className="rounded-[2rem] border border-ink/10 bg-white p-5"
              >
                <h3 className="font-display text-xl font-semibold text-ink">
                  {CONCERN_META[id].label}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  {CONCERN_META[id].explanation}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink/80">
                  <strong className="text-forest">What helps:</strong>{" "}
                  {CONCERN_META[id].advice}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-10">
            <h2 className="font-display text-3xl font-semibold text-forest">
              Your matched routine
            </h2>
            <p className="mt-1 max-w-2xl text-ink/65">
              Built from the concerns you picked — one targeted product per
              concern, plus the cleanser, moisturizer and SPF every routine
              needs, trimmed to your budget.
            </p>
            <div className="mt-6">
              <RoutineBuilder
                picks={picks}
                budget={budget}
                onBudgetChange={setBudget}
              />
            </div>
          </section>

          <p className="mt-8 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink/75">
            <strong>What&apos;s not here, on purpose:</strong> no skin
            score, no skin age, no foundation shade match and no virtual
            try-on — those only ever come from a real AI scan of your
            photo, never from guesses.{" "}
            <button
              type="button"
              onClick={onBack}
              className="font-semibold text-forest underline underline-offset-2"
            >
              Try the AI scan again
            </button>{" "}
            whenever you have a brighter, front-facing photo.
          </p>
        </>
      )}
    </div>
  );
}
