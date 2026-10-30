/**
 * Foundation shade catalogue + shade matching.
 *
 * The catalogue is one foundation line (Maison Lumière "Second Skin") in
 * 12 shades from Fair to Deep. Each shade carries a representative skin
 * colour (hex) — the same kind of value the YouCam Skin Tone Analysis
 * returns for the user — plus an undertone tag.
 *
 * Matching: convert the user's measured skin colour and every shade to
 * CIELAB, rank by colour distance (ΔE), with a penalty when the shade's
 * undertone fights the user's measured undertone (a warm user matched to
 * a cool shade needs the shade to be very close in colour to still rank).
 * Reasons are generated in plain language from the actual numbers, e.g.
 * "Matched to your warm undertone and medium depth."
 */

import {
  hexToLab,
  labDeltaE,
  type SkinToneResult,
  type Undertone,
} from "./normalize";
import type { Product } from "./catalog";

export interface FoundationShade {
  id: string;
  /** Shade code on the bottle, e.g. "400". */
  code: string;
  /** Shade name, e.g. "Golden Bronze". */
  name: string;
  /** Representative skin colour for this shade. */
  hex: string;
  undertone: Undertone;
  depthLabel: string;
  price: number; // USD
}

export const FOUNDATION_BRAND = "Maison Lumière";
export const FOUNDATION_PRODUCT_NAME = "Second Skin Liquid Foundation";

export const FOUNDATION_SHADES: FoundationShade[] = [
  { id: "shade-100", code: "100", name: "Porcelain", hex: "#f2dcc8", undertone: "cool", depthLabel: "Fair", price: 34 },
  { id: "shade-105", code: "105", name: "Ivory Glow", hex: "#f4e2c2", undertone: "warm", depthLabel: "Fair", price: 34 },
  { id: "shade-200", code: "200", name: "Vanilla", hex: "#eccfb0", undertone: "neutral", depthLabel: "Light", price: 34 },
  { id: "shade-205", code: "205", name: "Warm Sand", hex: "#e9c69c", undertone: "warm", depthLabel: "Light", price: 35 },
  { id: "shade-210", code: "210", name: "Rose Beige", hex: "#e9c0ab", undertone: "cool", depthLabel: "Light", price: 35 },
  { id: "shade-300", code: "300", name: "Honey", hex: "#dfb287", undertone: "warm", depthLabel: "Medium-light", price: 35 },
  { id: "shade-305", code: "305", name: "Natural Beige", hex: "#dab28e", undertone: "neutral", depthLabel: "Medium-light", price: 35 },
  { id: "shade-400", code: "400", name: "Golden Beige", hex: "#bd9673", undertone: "warm", depthLabel: "Medium", price: 36 },
  { id: "shade-405", code: "405", name: "Almond", hex: "#b78f66", undertone: "neutral", depthLabel: "Medium", price: 36 },
  { id: "shade-410", code: "410", name: "Soft Cocoa", hex: "#a97e5f", undertone: "cool", depthLabel: "Medium", price: 36 },
  { id: "shade-500", code: "500", name: "Caramel", hex: "#96683f", undertone: "warm", depthLabel: "Medium-deep", price: 37 },
  { id: "shade-600", code: "600", name: "Espresso", hex: "#6f4a2e", undertone: "neutral", depthLabel: "Deep", price: 37 },
];

export interface ShadeMatch {
  shade: FoundationShade;
  /** Plain-language reason this shade was matched. */
  reason: string;
  /** CIELAB distance to the user's measured skin colour (lower = closer). */
  deltaE: number;
  undertoneMatch: boolean;
  /** 1 = best match. */
  rank: number;
}

function undertonePenalty(user: Undertone, shade: Undertone): number {
  if (user === shade) return 0;
  if (user === "neutral" || shade === "neutral") return 5;
  return 11; // warm vs cool — a genuine mismatch
}

function matchReason(
  tone: SkinToneResult,
  shade: FoundationShade,
  deltaE: number,
  rank: number
): string {
  const depthBit =
    shade.depthLabel.toLowerCase() === tone.depthLabel.toLowerCase()
      ? `your ${tone.depthLabel.toLowerCase()} depth`
      : `a ${shade.depthLabel.toLowerCase()} shade right next to your measured ${tone.depthLabel.toLowerCase()} depth`;
  if (shade.undertone === tone.undertone) {
    return rank === 1
      ? `Your closest match — tuned to ${depthBit} and your ${tone.undertone} undertone (colour distance ${deltaE.toFixed(1)}).`
      : `Matched to your ${tone.undertone} undertone and ${depthBit}.`;
  }
  if (tone.undertone === "neutral" || shade.undertone === "neutral") {
    return `A ${shade.undertone} shade that sits comfortably on your ${tone.undertone} skin at ${depthBit} — a good second option if the first feels off.`;
  }
  return `The closest ${shade.undertone} option at ${depthBit} — worth a try-on if you prefer a ${
    shade.undertone === "cool" ? "rosier" : "more golden"
  } finish than your natural ${tone.undertone} undertone.`;
}

/**
 * Rank the catalogue against a measured skin tone and return the best
 * `count` matches, best first, each with a generated reason.
 */
export function matchShades(tone: SkinToneResult, count = 3): ShadeMatch[] {
  const skinLab = hexToLab(tone.skinColor);
  if (!skinLab) return [];
  const scored = FOUNDATION_SHADES.map((shade) => {
    const shadeLab = hexToLab(shade.hex);
    const deltaE = shadeLab ? labDeltaE(skinLab, shadeLab) : Number.POSITIVE_INFINITY;
    return {
      shade,
      deltaE,
      score: deltaE + undertonePenalty(tone.undertone, shade.undertone),
    };
  }).sort((a, b) => a.score - b.score);

  return scored.slice(0, count).map((entry, i) => ({
    shade: entry.shade,
    deltaE: entry.deltaE,
    undertoneMatch: entry.shade.undertone === tone.undertone,
    rank: i + 1,
    reason: matchReason(tone, entry.shade, entry.deltaE, i + 1),
  }));
}

/** Adapt a foundation shade into a catalog Product so it can join the cart. */
export function shadeToProduct(shade: FoundationShade): Product {
  return {
    id: `foundation-${shade.id}`,
    name: `${FOUNDATION_PRODUCT_NAME} · ${shade.code} ${shade.name}`,
    brand: FOUNDATION_BRAND,
    category: "Foundation",
    concerns: ["radiance", "texture"],
    price: shade.price,
    size: "30 ml",
    keyIngredient: `Shade ${shade.code} · ${shade.undertone} undertone · satin finish`,
    whyItMatches: `Shade-matched to your measured skin tone and virtually tried on your own photo.`,
    step: "base",
    timeOfDay: "AM",
  };
}

export function shadeById(id: string): FoundationShade | undefined {
  return FOUNDATION_SHADES.find((s) => s.id === id);
}
