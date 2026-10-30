"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applyBudget,
  routineTimeline,
  type RoutinePick,
} from "@/lib/recommend";

const BUDGETS: { label: string; value: number }[] = [
  { label: "Under $50", value: 50 },
  { label: "Under $100", value: 100 },
  { label: "Under $200", value: 200 },
  { label: "No limit", value: Number.POSITIVE_INFINITY },
];

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 === 0 ? 0 : 2 });

export default function RoutineBuilder({
  picks,
  budget,
  onBudgetChange,
}: {
  /** Full pick list (routine + any tried-on foundation), priority order. */
  picks: RoutinePick[];
  budget: number;
  onBudgetChange: (budget: number) => void;
}) {
  const [cart, setCart] = useState<Set<string>>(new Set());
  const [placed, setPlaced] = useState(false);

  const { included, excluded } = useMemo(
    () => applyBudget(picks, budget),
    [picks, budget]
  );

  // When the budget (or the pick list, e.g. a foundation is added) changes,
  // the cart resets to the in-budget picks.
  useEffect(() => {
    setCart(new Set(included.map((p) => p.product.id)));
    setPlaced(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget, picks]);

  const toggle = (pick: RoutinePick) => {
    setPlaced(false);
    setCart((prev) => {
      const next = new Set(prev);
      if (next.has(pick.product.id)) next.delete(pick.product.id);
      else next.add(pick.product.id);
      return next;
    });
  };

  const cartPicks = picks.filter((p) => cart.has(p.product.id));
  const cartTotal = cartPicks.reduce((s, p) => s + p.product.price, 0);
  const overBudget = Number.isFinite(budget) && cartTotal > budget;
  const timeline = routineTimeline(included);
  const budgetLabel = BUDGETS.find((b) => b.value === budget)?.label;

  const renderCard = (pick: RoutinePick, opts: { dimmed?: boolean }) => {
    const p = pick.product;
    const inCart = cart.has(p.id);
    return (
      <article
        key={p.id}
        className={`group flex flex-col rounded-3xl border bg-white p-5 shadow-[0_1px_0_rgba(31,61,43,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-16px_rgba(31,61,43,0.25)] ${
          opts.dimmed ? "border-ink/10 opacity-75" : "border-ink/10"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-clay">
            {p.brand}
          </span>
          <span className="rounded-full bg-parchment px-2 py-0.5 text-[11px] font-semibold text-ink/60">
            {p.timeOfDay === "AM/PM" ? "AM + PM" : p.timeOfDay}
          </span>
        </div>
        <h4 className="mt-1.5 font-display text-xl font-semibold leading-snug text-ink">
          {p.name}
        </h4>
        <p className="mt-0.5 text-xs font-medium text-ink/50">
          {p.category} · {p.size} · {p.keyIngredient}
        </p>
        <span className="mt-3 inline-flex w-fit rounded-full bg-pine/10 px-2.5 py-1 text-[11px] font-semibold text-pine">
          {pick.forLabel}
        </span>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/70">
          {pick.reason}
        </p>
        <div className="mt-4 flex items-center justify-between border-t border-ink/8 pt-4">
          <span className="font-display text-2xl font-semibold text-ink">
            {money(p.price)}
          </span>
          <button
            type="button"
            onClick={() => toggle(pick)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              inCart
                ? "bg-forest text-cream hover:bg-clay"
                : "bg-clay text-white hover:bg-forest"
            }`}
            aria-pressed={inCart}
          >
            {inCart ? "In your cart ✓" : "Add to cart"}
          </button>
        </div>
        {opts.dimmed && (
          <p className="mt-2 text-xs font-medium text-clay">
            Over the {budgetLabel?.toLowerCase()} budget — add it anyway if you want it.
          </p>
        )}
      </article>
    );
  };

  return (
    <div>
      {/* Budget filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-ink/70">
          Routine budget:
        </span>
        {BUDGETS.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() => onBudgetChange(b.value)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              budget === b.value
                ? "border-forest bg-forest text-cream"
                : "border-ink/15 bg-white text-ink/70 hover:border-forest/40 hover:text-forest"
            }`}
            aria-pressed={budget === b.value}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Picks */}
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            {included.map((pick) => renderCard(pick, {}))}
          </div>

          {excluded.length > 0 && (
            <>
              <h4 className="mt-8 font-display text-lg font-semibold text-ink">
                Held back by your budget
              </h4>
              <p className="mt-1 text-sm text-ink/60">
                These also match your skin — they just don&apos;t fit{" "}
                {budgetLabel?.toLowerCase()} together with the picks above.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {excluded.map((pick) => renderCard(pick, { dimmed: true }))}
              </div>
            </>
          )}

          {/* AM / PM timeline */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-parchment p-5">
              <h5 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink/60">
                <span aria-hidden>☀️</span> Morning routine
              </h5>
              <ol className="mt-3 space-y-1.5 text-sm text-ink/80">
                {timeline.am.map((name, i) => (
                  <li key={name} className="flex gap-2">
                    <span className="font-semibold text-clay">{i + 1}.</span>
                    {name}
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-3xl bg-forest p-5 text-cream">
              <h5 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cream/60">
                <span aria-hidden>🌙</span> Evening routine
              </h5>
              <ol className="mt-3 space-y-1.5 text-sm text-cream/90">
                {timeline.pm.map((name, i) => (
                  <li key={name} className="flex gap-2">
                    <span className="font-semibold text-blush">{i + 1}.</span>
                    {name}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Cart */}
        <aside className="h-fit rounded-3xl border border-ink/10 bg-white p-5 lg:sticky lg:top-24">
          <h4 className="font-display text-xl font-semibold text-ink">
            Your routine cart
          </h4>
          {cartPicks.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-ink/60">
              Your cart is empty. Add a product from your matched routine to
              see it here.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-ink/8">
              {cartPicks.map((pick) => (
                <li key={pick.product.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {pick.product.name}
                    </p>
                    <p className="text-xs text-ink/50">{pick.product.brand}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink tabular-nums">
                      {money(pick.product.price)}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggle(pick)}
                      className="rounded-full px-2 py-1 text-xs font-semibold text-clay hover:bg-clay/10"
                      aria-label={`Remove ${pick.product.name} from cart`}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 border-t border-ink/10 pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-ink/60">Total</span>
              <span className="font-display text-3xl font-semibold text-ink tabular-nums">
                {money(cartTotal)}
              </span>
            </div>
            {Number.isFinite(budget) && (
              <p
                className={`mt-1 text-right text-xs font-semibold ${
                  overBudget ? "text-clay" : "text-pine"
                }`}
              >
                {overBudget
                  ? `${money(cartTotal - budget)} over your ${budgetLabel?.toLowerCase()} budget`
                  : `Within your ${budgetLabel?.toLowerCase()} budget`}
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-ink/50">
              {cartTotal >= 75
                ? "Free shipping unlocked — this routine ships free."
                : `Add ${money(75 - cartTotal)} more for free shipping.`}
            </p>
            <button
              type="button"
              disabled={cartPicks.length === 0}
              onClick={() => setPlaced(true)}
              className="mt-4 w-full rounded-full bg-forest py-3 text-sm font-bold text-cream transition-colors hover:bg-clay disabled:cursor-not-allowed disabled:opacity-40"
            >
              Checkout routine
            </button>
            {placed && (
              <p className="mt-3 rounded-2xl bg-pine/10 px-3 py-2 text-center text-sm font-semibold text-pine" role="status">
                Order placed — demo checkout, nothing was charged. Your
                routine is on its way (in spirit).
              </p>
            )}
            <p className="mt-3 text-center text-[11px] leading-relaxed text-ink/40">
              Demo store for the YouCam API hackathon. Prices in USD; no real
              payment is processed.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
