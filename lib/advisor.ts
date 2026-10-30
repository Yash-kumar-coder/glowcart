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
    "your barrier is losing water faster than it should, which quietly makes every other concern look worse",
  dark_circle:
    "the under-eye area is showing fatigue and thin-skin shadowing",
  pore: "pores are stretched by oil and debris, so they read larger than they are",
  wrinkle: "fine lines are starting to set in where collagen is thinning",
  radiance: "dead-cell buildup is dulling the light your skin reflects",
  oiliness: "sebum is running high, especially through the T-zone",
  texture: "the surface is uneven, so light — and makeup — sit patchily on it",
  redness: "the barrier is stressed and flushing more easily than it should",
  eye_bag: "fluid is pooling under the eyes, most likely from sleep and salt",
  age_spot: "sun-driven pigmentation is accumulating faster than it fades",
  acne: "pores are clogging and inflaming into active breakouts",
  firmness: "elasticity is slipping as collagen support weakens",
};

const STEP_INSTRUCTION: Record<string, string> = {
  cleanse:
    "Massage in with lukewarm water for 30–60 seconds, then pat — never rub — dry.",
  tone: "Press into skin with your palms (skip the cotton pad). Two thin layers beat one thick one.",
  treat:
    "Apply 2–3 drops to slightly damp skin and give it 60 seconds before the next layer.",
  eye: "A rice-grain amount per eye, tapped with your ring finger along the orbital bone — never rubbed in.",
  moisturize:
    "A pea-sized amount over face and neck, pressed in to seal the layers beneath.",
  protect:
    "Two finger-lengths, applied last in the morning. Reapply every 2 hours outdoors.",
  base: "Wait 2 minutes after SPF, then blend your matched foundation from the centre of the face outward.",
};

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function scoreBand(overall: number): string {
  if (overall >= 80) return "that's strong, well-looked-after skin";
  if (overall >= 65) return "that's solidly healthy skin with a few clear priorities";
  if (overall >= 50) return "that's fair skin with real, fixable room to improve";
  return "your skin is clearly asking for help right now";
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
  const s1 = `Your overall skin score is ${skin.overallScore}/100 — ${scoreBand(skin.overallScore)}.`;
  const s2 = weakest
    ? ` The headline issue is ${weakest.label.toLowerCase()} at ${weakest.score}/100: ${
        CONCERN_CLAUSE[weakest.id] ?? weakest.explanation
      }${second ? `, with ${second.label.toLowerCase()} (${second.score}/100) close behind` : ""}.`
    : "";
  const s3 =
    (strongest && strongest.id !== weakest?.id
      ? ` On the plus side, your ${strongest.label.toLowerCase()} (${strongest.score}/100) is a genuine strength — the routine below protects it rather than fixing what isn't broken.`
      : "") +
    (skin.skinAge !== null
      ? ` Your skin reads as about ${skin.skinAge} years old${skin.skinAgeIsEstimate ? " (estimated from your wrinkle and firmness signals)" : ""}.`
      : "") +
    (tone
      ? ` Your tone measured ${tone.depthLabel.toLowerCase()} with a ${tone.undertone} undertone, which is why your foundation matches lean ${tone.undertone}.`
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
        reason: `${pick.reason} It earns its place because a foundation matched to your measured tone (${tone?.skinColor ?? "your scan"}) replaces guesswork with your actual colour.`,
      };
    }
    if (concern) {
      return {
        productId: p.id,
        productName: p.name,
        reason: `Because your ${concern.label.toLowerCase()} scored ${concern.score}/100 — ${
          concern.score < 65
            ? "well below the healthy 75+ range"
            : "the lowest of your stronger concerns"
        } — this is in your routine. ${p.whyItMatches}`,
      };
    }
    // Essentials: tie them to the user's weakest relevant signal.
    if (p.step === "cleanse") {
      const rel = scoreOf.get("oiliness") ?? scoreOf.get("moisture");
      return {
        productId: p.id,
        productName: p.name,
        reason: rel
          ? `Your ${rel.label.toLowerCase()} score is ${rel.score}/100, so your cleanser has to work with it, not against it. ${p.whyItMatches}`
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
          ? `UV is the main driver of your ${rel.label.toLowerCase()} score (${rel.score}/100). Without daily SPF, the rest of this routine is fighting the sun with one hand tied. ${p.whyItMatches}`
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
      `Your in-budget routine totals ${money(total)} of your ${money(budget)} budget` +
        (excluded.length === 0
          ? " — everything your skin asked for fits, nothing was held back."
          : `, leaving ${money(budget - total)} of headroom.`)
    );
  } else {
    budgetNotes.push(
      "No budget cap is set, so nothing was held back — the full matched routine is in."
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
    shadeNote = `Your skin colour measured ${tone.skinColor} — ${tone.depthLabel.toLowerCase()} depth, ${tone.undertone} undertone (ITA° ${tone.ita}). Shade ${best.shade.code} ${best.shade.name} is your closest match; try it on your own photo in the shade section before you buy, so the purchase is proven, not guessed.`;
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
