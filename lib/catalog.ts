/**
 * GlowCart demo product catalog.
 *
 * A static, curated catalog of realistic skincare products. Each product is
 * tagged with the canonical concern ids from lib/normalize.ts, the routine
 * step it fills, and when it is used (AM / PM / both) so the routine builder
 * can assemble a morning and evening routine from a user's weakest concerns.
 *
 * Prices are USD. This is demo catalog data for the hackathon — swap this
 * module for a real commerce feed (e.g. Shopify) to take it to production.
 */

export type RoutineStep = "cleanse" | "tone" | "treat" | "eye" | "moisturize" | "protect" | "base";
export type TimeOfDay = "AM" | "PM" | "AM/PM";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: "Cleanser" | "Toner" | "Serum" | "Treatment" | "Eye Care" | "Moisturizer" | "SPF" | "Foundation";
  /** Canonical concern ids this product targets. */
  concerns: string[];
  price: number; // USD
  size: string;
  keyIngredient: string;
  /** One-line "why it matches" copy shown on the card. */
  whyItMatches: string;
  step: RoutineStep;
  timeOfDay: TimeOfDay;
}

export const PRODUCTS: Product[] = [
  {
    id: "oat-milk-cleanser",
    name: "Gentle Oat Milk Cleanser",
    brand: "Verdé Botanics",
    category: "Cleanser",
    concerns: ["redness", "moisture"],
    price: 18,
    size: "150 ml",
    keyIngredient: "Colloidal oatmeal + squalane",
    whyItMatches: "Cleans without stripping, so a dry or reactive barrier is never set back at step one.",
    step: "cleanse",
    timeOfDay: "AM/PM",
  },
  {
    id: "foaming-balance-cleanser",
    name: "Foaming Balance Cleanser",
    brand: "Claro Lab",
    category: "Cleanser",
    concerns: ["oiliness", "pore", "acne"],
    price: 16,
    size: "150 ml",
    keyIngredient: "Green tea + zinc PCA",
    whyItMatches: "Lifts excess oil and debris out of pores while keeping sebum balanced, not stripped.",
    step: "cleanse",
    timeOfDay: "AM/PM",
  },
  {
    id: "pha-exfoliating-toner",
    name: "PHA Gentle Exfoliating Toner",
    brand: "Solstice Skin",
    category: "Toner",
    concerns: ["texture", "pore", "radiance"],
    price: 21,
    size: "120 ml",
    keyIngredient: "5% gluconolactone (PHA)",
    whyItMatches: "Dissolves the dull surface layer so skin looks smoother and reflects light evenly.",
    step: "tone",
    timeOfDay: "PM",
  },
  {
    id: "hydra-drench-serum",
    name: "Hydra-Drench Hyaluronic Serum",
    brand: "Maison Lumière",
    category: "Serum",
    concerns: ["moisture", "texture"],
    price: 32,
    size: "30 ml",
    keyIngredient: "5-weight hyaluronic acid + panthenol",
    whyItMatches: "Pulls water into every layer of the skin — the fastest fix for a low moisture score.",
    step: "treat",
    timeOfDay: "AM/PM",
  },
  {
    id: "niacinamide-serum",
    name: "Niacinamide 10% Pore-Refining Serum",
    brand: "Claro Lab",
    category: "Serum",
    concerns: ["pore", "oiliness", "texture"],
    price: 24,
    size: "30 ml",
    keyIngredient: "10% niacinamide + 1% zinc",
    whyItMatches: "Regulates oil at the source, which is what makes pores stretch and look enlarged.",
    step: "treat",
    timeOfDay: "AM/PM",
  },
  {
    id: "vitamin-c-serum",
    name: "Vitamin C Radiance Serum",
    brand: "Solstice Skin",
    category: "Serum",
    concerns: ["radiance", "age_spot", "wrinkle"],
    price: 38,
    size: "30 ml",
    keyIngredient: "12% stabilized vitamin C (SAP)",
    whyItMatches: "Brightens dullness and fades sun spots while defending against new pigmentation.",
    step: "treat",
    timeOfDay: "AM",
  },
  {
    id: "retinal-night-serum",
    name: "Retinal 0.1% Renewal Night Serum",
    brand: "Nocturne",
    category: "Serum",
    concerns: ["wrinkle", "firmness", "texture"],
    price: 46,
    size: "30 ml",
    keyIngredient: "0.1% retinaldehyde",
    whyItMatches: "The gold-standard collagen signal — softens fine lines and firms skin while you sleep.",
    step: "treat",
    timeOfDay: "PM",
  },
  {
    id: "azelaic-calm-treatment",
    name: "Azelaic Acid 10% Calm Treatment",
    brand: "Verdé Botanics",
    category: "Treatment",
    concerns: ["redness", "acne", "age_spot"],
    price: 27,
    size: "30 ml",
    keyIngredient: "10% azelaic acid",
    whyItMatches: "One ingredient that calms redness, clears blemishes and fades the marks they leave.",
    step: "treat",
    timeOfDay: "AM/PM",
  },
  {
    id: "salicylic-blemish-gel",
    name: "Salicylic Acid 2% Blemish Gel",
    brand: "Claro Lab",
    category: "Treatment",
    concerns: ["acne", "pore"],
    price: 19,
    size: "50 ml",
    keyIngredient: "2% salicylic acid (BHA)",
    whyItMatches: "Oil-soluble, so it clears blockages from inside the pore where breakouts start.",
    step: "treat",
    timeOfDay: "PM",
  },
  {
    id: "bakuchiol-oil",
    name: "Bakuchiol Smoothing Oil",
    brand: "Verdé Botanics",
    category: "Treatment",
    concerns: ["wrinkle", "radiance", "texture"],
    price: 36,
    size: "30 ml",
    keyIngredient: "1% bakuchiol + rosehip",
    whyItMatches: "A gentle plant-derived retinol alternative for smoother, firmer-looking skin.",
    step: "treat",
    timeOfDay: "PM",
  },
  {
    id: "caffeine-eye-concentrate",
    name: "Caffeine Eye Concentrate",
    brand: "Maison Lumière",
    category: "Eye Care",
    concerns: ["dark_circle", "eye_bag"],
    price: 29,
    size: "15 ml",
    keyIngredient: "5% caffeine + vitamin K",
    whyItMatches: "De-puffs and brightens the under-eye area — built exactly for dark circles and bags.",
    step: "eye",
    timeOfDay: "AM/PM",
  },
  {
    id: "ceramide-barrier-cream",
    name: "Ceramide Barrier Cream",
    brand: "Maison Lumière",
    category: "Moisturizer",
    concerns: ["moisture", "redness", "firmness"],
    price: 34,
    size: "50 ml",
    keyIngredient: "5 ceramides + cholesterol",
    whyItMatches: "Rebuilds the barrier so the hydration from your serums actually stays in.",
    step: "moisturize",
    timeOfDay: "AM/PM",
  },
  {
    id: "gel-moisturizer",
    name: "Featherlight Gel Moisturizer",
    brand: "Claro Lab",
    category: "Moisturizer",
    concerns: ["oiliness", "acne", "moisture"],
    price: 26,
    size: "50 ml",
    keyIngredient: "Aloe + beta-glucan",
    whyItMatches: "Hydration with zero grease — moisture for oily, breakout-prone skin that won't clog.",
    step: "moisturize",
    timeOfDay: "AM/PM",
  },
  {
    id: "peptide-firming-cream",
    name: "Peptide Firming Cream",
    brand: "Nocturne",
    category: "Moisturizer",
    concerns: ["firmness", "wrinkle"],
    price: 52,
    size: "50 ml",
    keyIngredient: "Matrixyl peptides + adenosine",
    whyItMatches: "Signals skin to hold its structure — the moisturizer step for firmness and lines.",
    step: "moisturize",
    timeOfDay: "PM",
  },
  {
    id: "invisible-shield-spf",
    name: "Invisible Shield SPF 50",
    brand: "Solstice Skin",
    category: "SPF",
    concerns: ["age_spot", "radiance", "wrinkle"],
    price: 22,
    size: "50 ml",
    keyIngredient: "SPF 50 PA++++, no white cast",
    whyItMatches: "UV is the #1 cause of spots and lines — this protects every other step's progress.",
    step: "protect",
    timeOfDay: "AM",
  },
];

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function productsForConcern(concernId: string): Product[] {
  return PRODUCTS.filter((p) => p.concerns.includes(concernId));
}
