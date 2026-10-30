/**
 * GlowAdvisor — a deterministic reasoning layer over the user's actual
 * measurements. No external LLM, no API keys: every sentence is generated
 * from the user's real numbers (concern scores, overall score, skin age,
 * measured skin colour / derived undertone, the routine picks and the
 * budget outcome), so the advice is genuinely *about this user*.
 *
 * It produces:
 *  - a 2–3 sentence personal skin summary,
 *  - a reason for every recommended product, tied to its score,
 *  - budget trade-off notes (what was held back and why), and
 *  - an AM/PM usage plan with per-step instructions.
 */

import type { SkinAnalysisResult, SkinToneResult } from "./normalize";
import { applyBudget, type RoutinePick } from "./recommend";
import type { ShadeMatch } from "./shades";

export interface AdvisorProductReason {
  productId: string;
  productName: string;
  reason: string;
}

export interface AdvisorPlanStep {
  productName: string;
  instruction: string;
}

export interface AdvisorReport {
  headline: string;
  summary: string;
  productReasons: AdvisorProductReason[];
  budgetNotes: string[];
  plan: { am: AdvisorPlanStep[]; pm: AdvisorPlanStep[] };
  shadeNote: string | null;
}

/** Short consequence clause per concern, used in the personal summary. */
const CONCERN_CLAUSE: Record<string, string> = {
  moisture:
    "your barrier is losing water faster than it should",
  dark_circle:
    "fatigue and thin-skin shadowing under the eyes",
  pore: "pores stretched by oil and debris",
  wrinkle: "fine lines setting in as collagen thins",
  radiance: "dead-cell buildup dulling your skin",
  oiliness: "sebum running high through the T-zone",
  texture: "an uneven surface makeup sits patchily on",
  redness: "a stressed barrier that flushes easily",
  eye_bag: "fluid pooling under the eyes",
  age_spot: "sun pigmentation building faster than it fades",
  acne: "pores clogging into active breakouts",
  firmness: "elasticity slipping as collagen weakens",
};

const STEP_INSTRUCTION: Record<string, string> = {
  cleanse:
    "Massage with lukewarm water, 30–60 seconds. Pat dry.",
  tone: "Press in with palms. Two thin layers.",
  treat:
    "2–3 drops on damp skin. Wait 60 seconds.",
  eye: "A rice-grain per eye, tapped with your ring finger.",
  moisturize:
    "A pea-sized amount over face and neck.",
  protect:
    "Two finger-lengths, last in the morning. Reapply outdoors every 2 hours.",
  base: "Two minutes after SPF, blend from the centre outward.",
};

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function scoreBand(overall: number): string {
  if (overall >= 80) return "strong, well-kept skin";
  if (overall >= 65) return "healthy skin, a few clear priorities";
  if (overall >= 50) return "fair skin, with fixable room to improve";
  return "skin asking for help";
}

export function buildAdvisorReport(args: {
  skin: SkinAnalysisResult;
  tone: SkinToneResult | null;
  picks: RoutinePick[];
  budget: number;
  matches: ShadeMatch[];
}): AdvisorReport {
  const { skin, tone, picks, budget, matches } = args;
  const scoreOf = new Map(skin.concerns.map((c) => [c.id, c]));
  const weakest = skin.concerns[0];
  const second = skin.concerns[1];
  const strongest = skin.concerns[skin.concerns.length - 1];

  /* ------------------------- personal summary ------------------------- */
  const s1 = `Skin score ${skin.overallScore}/100 — ${scoreBand(skin.overallScore)}.`;
  const s2 = weakest
    ? ` Priority: ${weakest.label.toLowerCase()} at ${weakest.score}/100 — ${
        CONCERN_CLAUSE[weakest.id] ?? weakest.explanation
      }${second ? `, then ${second.label.toLowerCase()} (${second.score}/100)` : ""}.`
    : "";
  const s3 =
    (strongest && strongest.id !== weakest?.id
      ? ` Your ${strongest.label.toLowerCase()} (${strongest.score}/100) is a real strength — the routine protects it.`
      : "") +
    (skin.skinAge !== null
      ? ` Skin age: about ${skin.skinAge}${skin.skinAgeIsEstimate ? " (estimate)" : ""}.`
      : "") +
    (tone
      ? ` Tone: ${tone.depthLabel.toLowerCase()}, ${tone.undertone} undertone.`
      : "");

  const headline = weakest
    ? `Priority #1: ${weakest.label.toLowerCase()} (${weakest.score}/100)`
    : "Your skin, explained";

  /* ------------------------- product reasons -------------------------- */
  const productReasons: AdvisorProductReason[] = picks.map((pick) => {
    const p = pick.product;
    const concern = scoreOf.get(pick.forConcern);
    if (pick.forConcern === "shade-match") {
      return {
        productId: p.id,
        productName: p.name,
        reason: pick.reason,
      };
    }
    if (concern) {
      return {
        productId: p.id,
        productName: p.name,
        reason: `Your ${concern.label.toLowerCase()} scored ${concern.score}/100. ${p.whyItMatches}`,
      };
    }
    // Essentials: tie them to the user's weakest relevant signal.
    if (p.step === "cleanse") {
      const rel = scoreOf.get("oiliness") ?? scoreOf.get("moisture");
      return {
        productId: p.id,
        productName: p.name,
        reason: rel
          ? `Chosen for your ${rel.label.toLowerCase()} score (${rel.score}/100). ${p.whyItMatches}`
          : p.whyItMatches,
      };
    }
    if (p.step === "protect") {
      const spot = scoreOf.get("age_spot");
      const wr = scoreOf.get("wrinkle");
      const rel =
        spot && wr ? (spot.score <= wr.score ? spot : wr) : (spot ?? wr);
      return {
        productId: p.id,
        productName: p.name,
        reason: rel
          ? `UV drives your ${rel.label.toLowerCase()} score (${rel.score}/100). ${p.whyItMatches}`
          : p.whyItMatches,
      };
    }
    return { productId: p.id, productName: p.name, reason: pick.reason };
  });

  /* -------------------------- budget notes ---------------------------- */
  const { included, excluded, total } = applyBudget(picks, budget);
  const budgetNotes: string[] = [];
  if (Number.isFinite(budget)) {
    budgetNotes.push(
      `Routine: ${money(total)} of your ${money(budget)} budget` +
        (excluded.length === 0
          ? " — everything fits."
          : `, leaving ${money(budget - total)} of headroom.`)
    );
  } else {
    budgetNotes.push(
      "No budget cap — the full routine is in."
    );
  }
  excluded.forEach((pick, i) => {
    const concern = scoreOf.get(pick.forConcern);
    budgetNotes.push(
      `Held back: ${pick.product.name} (${money(pick.product.price)}) — ${
        concern
          ? `it targets ${concern.label.toLowerCase()} at ${concern.score}/100`
          : pick.forConcern === "shade-match"
            ? "it's the foundation shade you matched and tried on"
            : `it's one of your routine essentials (${pick.forLabel.replace("Essential · ", "").toLowerCase()})`
      }. ${
        i === 0
          ? "It's the first thing to add when the budget grows."
          : "Add it after the held-back item above it."
      }`
    );
  });
  if (excluded.length > 0 && Number.isFinite(budget)) {
    const cheapestExcluded = Math.min(...excluded.map((e) => e.product.price));
    budgetNotes.push(
      `Tip: raising the budget by ${money(Math.max(0, cheapestExcluded - (budget - total)))} would unlock the next held-back product without rethinking the whole routine.`
    );
  }

  /* ------------------------------ plan -------------------------------- */
  // The plan follows the in-budget routine — what the user will actually use.
  const planFor = (when: "AM" | "PM"): AdvisorPlanStep[] =>
    included
      .filter((pick) =>
        when === "AM"
          ? pick.product.timeOfDay !== "PM"
          : pick.product.timeOfDay !== "AM"
      )
      .map((pick) => ({
        productName: pick.product.name,
        instruction:
          STEP_INSTRUCTION[pick.product.step] ?? "Use as directed on the packaging.",
      }));

  /* ---------------------------- shade note ---------------------------- */
  let shadeNote: string | null = null;
  if (tone && matches.length > 0) {
    const best = matches[0];
    shadeNote = `Skin colour ${tone.skinColor} — ${tone.depthLabel.toLowerCase()}, ${tone.undertone} undertone. Closest match: ${best.shade.code} ${best.shade.name}. Try it on below before you buy.`;
  } else if (tone) {
    shadeNote = `Your skin colour measured ${tone.skinColor} — ${tone.depthLabel.toLowerCase()} depth with a ${tone.undertone} undertone.`;
  }

  return {
    headline,
    summary: `${s1}${s2}${s3}`.trim(),
    productReasons,
    budgetNotes,
    plan: { am: planFor("AM"), pm: planFor("PM") },
    shadeNote,
  };
}
