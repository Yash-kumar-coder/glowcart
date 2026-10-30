/**
 * Routine builder: turns a SkinAnalysisResult into a shoppable routine.
 *
 * Rules:
 *  - The user's 3 weakest concerns drive the "treatment" picks — one hero
 *    product per concern, chosen to also cover other weak concerns when
 *    possible, and never repeating a product.
 *  - Three essentials are always added: a cleanser, a moisturizer and an
 *    SPF, each selected to match the user's weak concerns (e.g. oily skin
 *    gets the foaming cleanser + gel moisturizer, dry/sensitive skin gets
 *    the oat cleanser + ceramide cream).
 *  - Picks carry priority: essentials first, then treatments in concern
 *    order (weakest concern first). The budget filter walks picks in
 *    priority order and includes each while the running total fits.
 */

import { PRODUCTS, type Product } from "./catalog";
import type { SkinAnalysisResult } from "./normalize";

export interface RoutinePick {
  product: Product;
  /** Concern id this pick is "for" (essential picks use a step label). */
  forConcern: string;
  /** "Essential" or the concern label, for the UI badge. */
  forLabel: string;
  reason: string;
  /** Lower = shop first. Essentials 0-2, treatments 10+. */
  priority: number;
}

const STEP_ORDER: Record<Product["step"], number> = {
  cleanse: 0,
  tone: 1,
  treat: 2,
  eye: 3,
  moisturize: 4,
  protect: 5,
  base: 6, // foundation goes on last, after SPF has set
};

function bestProductFor(
  concernIds: string[],
  predicate: (p: Product) => boolean,
  exclude: Set<string>
): Product | undefined {
  const candidates = PRODUCTS.filter(
    (p) => predicate(p) && !exclude.has(p.id)
  );
  if (candidates.length === 0) return undefined;
  // Score by overlap with the (ordered) weak-concern list; earlier = stronger.
  const scored = candidates.map((p) => {
    let score = 0;
    concernIds.forEach((cid, idx) => {
      if (p.concerns.includes(cid)) score += (concernIds.length - idx) * 10;
    });
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score || a.p.price - b.p.price);
  return scored[0].p;
}

export function buildRoutine(result: SkinAnalysisResult): RoutinePick[] {
  const weak = result.concerns.slice(0, 3); // weakest first (already sorted)
  const weakIds = result.concerns.slice(0, 5).map((c) => c.id);
  const used = new Set<string>();
  const picks: RoutinePick[] = [];

  const addPick = (
    product: Product | undefined,
    forConcern: string,
    forLabel: string,
    reason: string,
    priority: number
  ) => {
    if (!product || used.has(product.id)) return;
    used.add(product.id);
    picks.push({ product, forConcern, forLabel, reason, priority });
  };

  // --- Essentials first ---
  const cleanser = bestProductFor(weakIds, (p) => p.step === "cleanse", used);
  addPick(
    cleanser,
    "essential",
    "Essential · Cleanse",
    cleanser
      ? `Matched to your skin: ${cleanser.whyItMatches}`
      : "A gentle daily cleanser is the base of every routine.",
    0
  );

  const moisturizer = bestProductFor(
    weakIds,
    (p) => p.step === "moisturize",
    used
  );
  addPick(
    moisturizer,
    "essential",
    "Essential · Moisturize",
    moisturizer
      ? `Matched to your skin: ${moisturizer.whyItMatches}`
      : "Locks in hydration and supports the skin barrier.",
    1
  );

  const spf = bestProductFor(weakIds, (p) => p.step === "protect", used);
  addPick(
    spf,
    "essential",
    "Essential · Protect",
    spf
      ? `Non-negotiable: ${spf.whyItMatches}`
      : "Daily SPF protects the progress of every other step.",
    2
  );

  // --- One hero treatment per weak concern ---
  weak.forEach((concern, i) => {
    const hero = bestProductFor(
      [concern.id, ...weakIds],
      (p) =>
        p.concerns.includes(concern.id) &&
        (p.step === "treat" || p.step === "eye" || p.step === "tone"),
      used
    );
    addPick(
      hero,
      concern.id,
      `For your ${concern.label.toLowerCase()} · score ${concern.score}`,
      hero
        ? hero.whyItMatches
        : concern.advice,
      10 + i
    );
  });

  return picks.sort(
    (a, b) =>
      a.priority - b.priority ||
      STEP_ORDER[a.product.step] - STEP_ORDER[b.product.step]
  );
}

/**
 * Apply a budget cap to routine picks: walk in priority order and keep a
 * pick while the running total stays within the budget.
 * budget = Infinity means "no limit".
 */
export function applyBudget(
  picks: RoutinePick[],
  budget: number
): { included: RoutinePick[]; excluded: RoutinePick[]; total: number } {
  const included: RoutinePick[] = [];
  const excluded: RoutinePick[] = [];
  let total = 0;
  for (const pick of picks) {
    if (total + pick.product.price <= budget) {
      included.push(pick);
      total += pick.product.price;
    } else {
      excluded.push(pick);
    }
  }
  return { included, excluded, total };
}

/** AM / PM step lists for the routine summary strip. */
export function routineTimeline(picks: RoutinePick[]): {
  am: string[];
  pm: string[];
} {
  const byStep = (a: RoutinePick, b: RoutinePick) =>
    STEP_ORDER[a.product.step] - STEP_ORDER[b.product.step];
  const names = (list: RoutinePick[]) =>
    [...list].sort(byStep).map((p) => p.product.name);
  return {
    am: names(picks.filter((p) => p.product.timeOfDay !== "PM")),
    pm: names(picks.filter((p) => p.product.timeOfDay !== "AM")),
  };
}
