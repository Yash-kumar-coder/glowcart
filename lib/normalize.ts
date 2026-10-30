/**
 * Types + normalization for YouCam AI Skin Analysis results.
 *
 * The real YouCam V2 API returns scores in two documented shapes:
 *
 *  A) The task-result payload (GET /s2s/v2.0/task/skin-analysis/<task_id>):
 *     {
 *       "status": 200,
 *       "data": {
 *         "task_status": "success",
 *         "results": {
 *           "output": [
 *             { "type": "texture", "ui_score": 68, "raw_score": 57.33,
 *               "mask_urls": ["https://.../texture_output.jpg"] },
 *             ...
 *           ],
 *           // some responses also embed the full score_info object here
 *         }
 *       }
 *     }
 *
 *  B) The `score_info.json` object (returned with format:"json" / in the ZIP):
 *     {
 *       "wrinkle":  { "raw_score": 36.09, "ui_score": 60, "output_mask_name": "wrinkle_output.png" },
 *       "hd_pore":  { "whole": { "raw_score": 49.2, "ui_score": 67, ... },
 *                     "nose":  { "raw_score": 29.1, "ui_score": 58, ... } },
 *       "all":      { "score": 75.76 },
 *       "skin_age": 37
 *     }
 *
 * This normalizer accepts either shape (or a mix), tolerates missing fields,
 * strips "hd_" prefixes, maps "dark_circle_v2" -> "dark_circle", collapses
 * sub-region scores (using the documented "whole" aggregate when present,
 * otherwise the weakest sub-region), and always produces the app's
 * SkinAnalysisResult.
 */

export interface ConcernScore {
  /** Canonical concern id, e.g. "moisture" */
  id: string;
  /** Human label, e.g. "Moisture" */
  label: string;
  /** UI score 0-100. Higher = healthier skin for that concern. */
  score: number;
  /** Raw model score 0-100 when the API provided one. */
  rawScore: number | null;
  /** Detection mask image URL when the API provided one. */
  maskUrl?: string;
  /** Plain-language explanation of what this concern means. */
  explanation: string;
  /** What a low score usually calls for. */
  advice: string;
}

export interface SkinAnalysisResult {
  /** Overall skin score 0-100 (YouCam "all" score, or derived). */
  overallScore: number;
  /** AI-estimated skin age, when reported or estimable. */
  skinAge: number | null;
  /** True when skinAge came from our fallback estimate, not the API. */
  skinAgeIsEstimate: boolean;
  /** Per-concern scores, sorted weakest first. */
  concerns: ConcernScore[];
  /** Where the result came from. */
  source: "youcam" | "demo";
  /** ISO timestamp of when normalization happened. */
  analyzedAt: string;
}

interface ConcernMeta {
  label: string;
  explanation: string;
  advice: string;
}

/** Canonical concern metadata, in the order the app prefers to display ties. */
export const CONCERN_META: Record<string, ConcernMeta> = {
  moisture: {
    label: "Moisture",
    explanation:
      "How hydrated your skin barrier is. Low moisture leaves skin tight and flaky.",
    advice: "Layer humectants (hyaluronic acid, glycerin) and seal them in with ceramides.",
  },
  wrinkle: {
    label: "Wrinkles",
    explanation:
      "Fine lines and creases — forehead, eyes, mouth. They deepen as collagen declines.",
    advice: "Retinoids at night, peptides, and daily SPF to stop lines deepening.",
  },
  acne: {
    label: "Acne & Blemishes",
    explanation:
      "Active breakouts and clogged pores, driven by oil and dead-skin buildup.",
    advice: "Salicylic acid or azelaic acid treatments, plus a non-comedogenic moisturizer.",
  },
  pore: {
    label: "Pores",
    explanation:
      "How visible your pores look — larger when stretched by oil and debris.",
    advice: "Niacinamide and gentle BHA exfoliation help pores look tighter over time.",
  },
  oiliness: {
    label: "Oiliness",
    explanation:
      "How much sebum your skin produces. Excess oil means shine and congestion.",
    advice: "Lightweight gel textures and niacinamide to balance — never harsh stripping cleansers.",
  },
  redness: {
    label: "Redness",
    explanation:
      "Flushing and irritation — a sign the barrier is stressed.",
    advice: "Azelaic acid, centella and ceramide creams calm and rebuild the barrier.",
  },
  dark_circle: {
    label: "Dark Circles",
    explanation:
      "Shadowing under the eyes — thin skin, fatigue, genetics.",
    advice: "Caffeine and vitamin K eye products, gentle handling, and consistent sleep.",
  },
  eye_bag: {
    label: "Eye Bags",
    explanation:
      "Puffiness under the eyes — fluid, salt, allergies, lost sleep.",
    advice: "Caffeine-based eye concentrates and a cool compress in the morning.",
  },
  firmness: {
    label: "Firmness",
    explanation:
      "How springy and elastic your skin feels. Drops as collagen breaks down.",
    advice: "Peptides, retinoids and daily sun protection to support collagen.",
  },
  radiance: {
    label: "Radiance",
    explanation:
      "How bright and even-toned your skin looks. Dullness comes from dead-cell buildup.",
    advice: "Vitamin C in the morning and gentle PHA/AHA exfoliation a few times a week.",
  },
  texture: {
    label: "Texture",
    explanation:
      "Overall smoothness — roughness and bumps that makeup sits unevenly on.",
    advice: "Gentle chemical exfoliation and consistent hydration smooth texture fastest.",
  },
  age_spot: {
    label: "Age Spots",
    explanation:
      "Flat brown spots and uneven pigmentation caused mainly by cumulative sun exposure.",
    advice: "Vitamin C, azelaic acid and — above all — daily broad-spectrum SPF.",
  },
};

/** All canonical concern ids this app understands. */
export const CONCERN_IDS = Object.keys(CONCERN_META);

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Map any YouCam action/type name to our canonical concern id. */
export function canonicalConcernId(rawType: string): string | null {
  let t = rawType.toLowerCase().trim();
  if (t.startsWith("hd_")) t = t.slice(3);
  if (t === "dark_circle_v2" || t === "darkcircle") t = "dark_circle";
  if (t === "age_spot" || t === "agespot") t = "age_spot";
  if (t === "eye_bag" || t === "eyebag") t = "eye_bag";
  return t in CONCERN_META ? t : null;
}

interface ScoreEntry {
  ui: number;
  raw: number | null;
  maskUrl?: string;
}

/**
 * Extract a single {ui, raw} pair from a score_info category value.
 * Handles flat entries, {whole: {...}} wrappers, and sub-region maps
 * (forehead/nose/cheek/...). When a "whole" aggregate exists it wins —
 * it's the concern-level score; otherwise the weakest sub-region is used.
 */
function extractScoreEntry(value: unknown): ScoreEntry | null {
  if (!isRecord(value)) return null;

  const directUi = num(value.ui_score);
  const directRaw = num(value.raw_score);
  if (directUi !== null) {
    return { ui: directUi, raw: directRaw };
  }
  // Sometimes only a raw score is present.
  if (directRaw !== null) return { ui: directRaw, raw: directRaw };

  // Nested: { whole: {...}, nose: {...}, ... } — weakest sub-region wins.
  let weakest: ScoreEntry | null = null;
  let whole: ScoreEntry | null = null;
  for (const [key, sub] of Object.entries(value)) {
    const entry = extractScoreEntry(sub);
    if (!entry) continue;
    if (key.toLowerCase() === "whole") whole = entry;
    if (!weakest || entry.ui < weakest.ui) weakest = entry;
  }
  return whole ?? weakest;
}

/** Find a score_info-style map anywhere in a task response. */
function findScoreInfo(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const candidates: unknown[] = [
    raw.score_info,
    isRecord(raw.data) ? raw.data.score_info : undefined,
    isRecord(raw.data) && isRecord(raw.data.results)
      ? raw.data.results.score_info
      : undefined,
    isRecord(raw.results) ? raw.results.score_info : undefined,
    // The raw payload itself may BE a score_info object.
    raw,
    isRecord(raw.data) ? raw.data : undefined,
  ];
  for (const c of candidates) {
    if (isRecord(c) && ("all" in c || "skin_age" in c || CONCERN_IDS.some((id) => id in c || `hd_${id}` in c))) {
      return c;
    }
  }
  return null;
}

/** Find the V2 "output" array of per-concern results. */
function findOutputArray(raw: unknown): Record<string, unknown>[] | null {
  if (!isRecord(raw)) return null;
  const candidates: unknown[] = [
    isRecord(raw.data) && isRecord(raw.data.results)
      ? raw.data.results.output
      : undefined,
    isRecord(raw.results) ? raw.results.output : undefined,
    raw.output,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c.filter(isRecord);
  }
  return null;
}

function extractOverall(
  scoreInfo: Record<string, unknown> | null,
  raw: unknown
): number | null {
  const fromInfo = (() => {
    if (!scoreInfo) return null;
    const all = scoreInfo.all;
    if (typeof all === "number") return all;
    if (isRecord(all)) return num(all.score) ?? num(all.ui_score) ?? num(all.raw_score);
    return num(scoreInfo.overall_score) ?? num(scoreInfo.all_score);
  })();
  if (fromInfo !== null) return fromInfo;
  if (isRecord(raw)) {
    return (
      num(raw.overall_score) ??
      (isRecord(raw.data) ? num(raw.data.overall_score) : null)
    );
  }
  return null;
}

function extractSkinAge(
  scoreInfo: Record<string, unknown> | null,
  raw: unknown
): number | null {
  const age =
    (scoreInfo ? num(scoreInfo.skin_age) : null) ??
    (isRecord(raw) ? num(raw.skin_age) : null) ??
    (isRecord(raw) && isRecord(raw.data) ? num(raw.data.skin_age) : null) ??
    (isRecord(raw) && isRecord(raw.data) && isRecord(raw.data.results)
      ? num(raw.data.results.skin_age)
      : null);
  return age !== null ? Math.round(age) : null;
}

/* ------------------------------------------------------------------ */
/* main normalizer                                                     */
/* ------------------------------------------------------------------ */

/**
 * Normalize any YouCam skin-analysis payload into the app shape.
 * Never throws on missing fields — absent concerns are simply omitted,
 * and overall/skin-age fall back to derived values when unreported.
 */
export function normalizeYouCamResult(
  raw: unknown,
  source: "youcam" | "demo"
): SkinAnalysisResult {
  const byId = new Map<string, ScoreEntry & { maskUrl?: string }>();

  // --- Shape B: score_info map ---
  const scoreInfo = findScoreInfo(raw);
  if (scoreInfo) {
    for (const [key, value] of Object.entries(scoreInfo)) {
      if (key === "all" || key === "skin_age") continue;
      const id = canonicalConcernId(key);
      if (!id) continue;
      const entry = extractScoreEntry(value);
      if (entry && !byId.has(id)) byId.set(id, entry);
    }
  }

  // --- Shape A: results.output array ---
  const output = findOutputArray(raw);
  if (output) {
    for (const item of output) {
      const type = typeof item.type === "string" ? item.type : "";
      const id = type ? canonicalConcernId(type) : null;
      if (!id) continue;
      const ui = num(item.ui_score) ?? num(item.raw_score);
      if (ui === null) continue;
      const maskUrls = Array.isArray(item.mask_urls) ? item.mask_urls : [];
      const maskUrl = maskUrls.find((u) => typeof u === "string") as
        | string
        | undefined;
      const existing = byId.get(id);
      byId.set(id, {
        ui,
        raw: num(item.raw_score),
        maskUrl: maskUrl ?? existing?.maskUrl,
      });
    }
  }

  const concerns: ConcernScore[] = [...byId.entries()]
    .map(([id, entry]) => ({
      id,
      label: CONCERN_META[id].label,
      score: clampScore(entry.ui),
      rawScore: entry.raw !== null ? Math.round(entry.raw * 10) / 10 : null,
      maskUrl: entry.maskUrl,
      explanation: CONCERN_META[id].explanation,
      advice: CONCERN_META[id].advice,
    }))
    .sort((a, b) => a.score - b.score); // weakest first

  // --- Overall score: API "all" wins; otherwise average the concerns ---
  let overall = extractOverall(scoreInfo, raw);
  if (overall === null && concerns.length > 0) {
    overall =
      concerns.reduce((sum, c) => sum + c.score, 0) / concerns.length;
  }

  // --- Skin age: API value wins; otherwise a conservative estimate ---
  let skinAge = extractSkinAge(scoreInfo, raw);
  let skinAgeIsEstimate = false;
  if (skinAge === null) {
    const wrinkle = byId.get("wrinkle")?.ui;
    const firmness = byId.get("firmness")?.ui;
    const signals = [wrinkle, firmness].filter(
      (v): v is number => typeof v === "number"
    );
    if (signals.length > 0) {
      const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
      skinAge = Math.max(16, Math.min(70, Math.round(46 - avg * 0.28)));
      skinAgeIsEstimate = true;
    }
  }

  return {
    overallScore: overall !== null ? clampScore(overall) : 0,
    skinAge,
    skinAgeIsEstimate,
    concerns,
    source,
    analyzedAt: new Date().toISOString(),
  };
}

/* ================================================================== */
/* Skin Tone Analysis                                                  */
/* ================================================================== */
/*
 * The documented V2 skin-tone-analysis success payload:
 *   { "status": 200, "data": { "task_status": "success", "results": {
 *       "face_quality": { "has_face": true, "area": "good",
 *                         "frontal": "good", "lighting": "good",
 *                         "faceangle": "good" },
 *       "color": { "eye_color": "#62432e", "eye_color_name": "Amber",
 *                  "lip_color": "#b26a5e", "eyebrow_color": "#3a2a20",
 *                  "skin_color": "#b9947c",
 *                  "hair_color": "#a05a3c", "hair_color_name": "Auburn" } } } }
 * The guide also shows a minimal form: { "skin_color": "#b28e73" }.
 *
 * The API reports the measured skin COLOUR as a hex value — it does not
 * return named depth/undertone fields — so GlowCart derives them with
 * standard colour science (documented in the functions below):
 *   - depth     from the ITA° (Individual Typology Angle), the
 *               dermatology-standard classification of skin colour from
 *               CIELAB L* and b*: ITA = atan((L* - 50) / b*) in degrees.
 *   - undertone from the CIELAB a-star / b-star balance: yellow-dominant
 *               (b-star >> a-star) reads warm/golden, red-dominant reads
 *               cool/rosy, and a balanced ratio reads neutral.
 */

export type Undertone = "warm" | "cool" | "neutral";
export type SkinDepth =
  | "fair"
  | "light"
  | "medium"
  | "medium-deep"
  | "deep"
  | "rich-deep";

export interface SkinToneResult {
  /** Measured skin colour as reported by the API, e.g. "#b9947c". */
  skinColor: string;
  /** Derived depth band + label (from ITA°). */
  depth: SkinDepth;
  depthLabel: string;
  /** The ITA° value the depth band was derived from. */
  ita: number;
  /** Derived undertone + label (from the a-star / b-star balance). */
  undertone: Undertone;
  undertoneLabel: string;
  eyeColor: string | null;
  eyeColorName: string | null;
  eyebrowColor: string | null;
  lipColor: string | null;
  hairColor: string | null;
  hairColorName: string | null;
  source: "youcam" | "demo";
  analyzedAt: string;
}

/* ------------------------- colour science ------------------------- */

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

export function hexToRgb(
  hex: string
): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function srgbToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Convert an sRGB hex colour to CIELAB (D65). */
export function hexToLab(hex: string): LabColor | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  // sRGB -> XYZ (D65)
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** CIE76 colour difference — good enough for ranking nearby shades. */
export function labDeltaE(p: LabColor, q: LabColor): number {
  return Math.sqrt(
    (p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2
  );
}

/** ITA° bands used in dermatology (Chardon et al.), mapped to app labels. */
export function depthFromLab(lab: LabColor): {
  depth: SkinDepth;
  depthLabel: string;
  ita: number;
} {
  if (lab.b > 0.5) {
    const ita = (Math.atan((lab.L - 50) / lab.b) * 180) / Math.PI;
    if (ita > 55) return { depth: "fair", depthLabel: "Fair", ita };
    if (ita > 41) return { depth: "light", depthLabel: "Light", ita };
    if (ita > 28) return { depth: "medium", depthLabel: "Medium", ita };
    if (ita > 10)
      return { depth: "medium-deep", depthLabel: "Medium-deep", ita };
    if (ita > -30) return { depth: "deep", depthLabel: "Deep", ita };
    return { depth: "rich-deep", depthLabel: "Rich deep", ita };
  }
  // Fallback if b* is not usable (shouldn't happen for real skin colours):
  // classify on lightness alone.
  const ita = 0;
  if (lab.L >= 72) return { depth: "fair", depthLabel: "Fair", ita };
  if (lab.L >= 63) return { depth: "light", depthLabel: "Light", ita };
  if (lab.L >= 54) return { depth: "medium", depthLabel: "Medium", ita };
  if (lab.L >= 45)
    return { depth: "medium-deep", depthLabel: "Medium-deep", ita };
  if (lab.L >= 36) return { depth: "deep", depthLabel: "Deep", ita };
  return { depth: "rich-deep", depthLabel: "Rich deep", ita };
}

/** Undertone from the CIELAB a* (red-green) / b* (yellow-blue) balance. */
export function undertoneFromLab(lab: LabColor): Undertone {
  const { a, b } = lab;
  if (a <= 2) return "warm"; // virtually no red component — golden/yellow skin
  if (b >= a * 1.5) return "warm"; // yellow clearly dominates
  if (a >= b * 1.15) return "cool"; // red/pink clearly dominates
  return "neutral";
}

/* ------------------------- tone normalizer ------------------------ */

function findColorBlock(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const candidates: unknown[] = [
    isRecord(raw.data) && isRecord(raw.data.results)
      ? raw.data.results.color
      : undefined,
    isRecord(raw.results) ? raw.results.color : undefined,
    isRecord(raw.data) ? raw.data.color : undefined,
    raw.color,
    // Minimal documented shape: the colour fields sit at results/data level.
    isRecord(raw.data) && isRecord(raw.data.results)
      ? raw.data.results
      : undefined,
    isRecord(raw.results) ? raw.results : undefined,
    isRecord(raw.data) ? raw.data : undefined,
    raw,
  ];
  for (const c of candidates) {
    if (
      isRecord(c) &&
      (typeof c.skin_color === "string" || typeof c.skinColor === "string")
    ) {
      return c;
    }
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/**
 * Normalize a YouCam skin-tone-analysis payload into SkinToneResult.
 * Returns null when no usable skin colour is present.
 */
export function normalizeSkinToneResult(
  raw: unknown,
  source: "youcam" | "demo"
): SkinToneResult | null {
  const color = findColorBlock(raw);
  if (!color) return null;
  const skinColor = str(color.skin_color) ?? str(color.skinColor);
  if (!skinColor) return null;
  const lab = hexToLab(skinColor);
  if (!lab) return null;

  const { depth, depthLabel, ita } = depthFromLab(lab);
  const undertone = undertoneFromLab(lab);

  return {
    skinColor,
    depth,
    depthLabel,
    ita: Math.round(ita * 10) / 10,
    undertone,
    undertoneLabel:
      undertone === "warm"
        ? "Warm"
        : undertone === "cool"
          ? "Cool"
          : "Neutral",
    eyeColor: str(color.eye_color),
    eyeColorName: str(color.eye_color_name),
    eyebrowColor: str(color.eyebrow_color),
    lipColor: str(color.lip_color),
    hairColor: str(color.hair_color),
    hairColorName: str(color.hair_color_name),
    source,
    analyzedAt: new Date().toISOString(),
  };
}
