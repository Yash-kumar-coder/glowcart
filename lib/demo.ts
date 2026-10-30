/**
 * Demo mode support.
 *
 * When YOUCAM_API_KEY is not set, every flow runs against this module
 * instead of the real Perfect Corp API. The sample payloads below are
 * realistic YouCam responses in the documented shapes (same field names,
 * same nesting) so they flow through the exact same normalizers as real
 * API results — only the source flag differs, and the UI labels demo
 * results clearly.
 *
 * Three features are demoed: skin-analysis, skin-tone-analysis and
 * makeup-vto. Makeup VTO has no sample image payload — a demo try-on
 * resolves "success" with no image URL, and the client renders a clearly
 * labeled approximation from the user's own photo instead.
 */

export type DemoFeature = "skin" | "tone" | "tryon";

/** How long a fake demo task stays in "running" state, per feature. */
const DEMO_TASK_MS: Record<DemoFeature, number> = {
  skin: 5000,
  tone: 3500,
  tryon: 4500,
};

/**
 * Demo tasks are STATELESS by design: the task id itself carries the
 * feature and the creation time (`demo_<feature>_<base36 timestamp>_<rand>`),
 * so any server instance can resolve a task without shared memory. This
 * matters on serverless hosting (e.g. Vercel), where the POST that creates
 * a task and the GET that polls it may run in different containers — an
 * in-memory task map silently loses tasks there and polling falls through
 * to the live API path.
 */
export function createDemoTask(feature: DemoFeature = "skin"): string {
  return `demo_${feature}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function isDemoTask(taskId: string): boolean {
  return taskId.startsWith("demo_");
}

export type DemoTaskState =
  | { state: "running" }
  | { state: "success"; payload: unknown }
  | { state: "error"; message: string; code: string };

export function getDemoTaskState(taskId: string): DemoTaskState {
  const parts = taskId.split("_");
  const feature = (parts[1] ?? "skin") as DemoFeature;
  const startedAt = Number.parseInt(parts[2] ?? "", 36);
  if (
    Number.isFinite(startedAt) &&
    Date.now() - startedAt < (DEMO_TASK_MS[feature] ?? DEMO_TASK_MS.skin)
  ) {
    return { state: "running" };
  }
  if (feature === "tone") {
    return { state: "success", payload: DEMO_TONE_RESPONSE };
  }
  if (feature === "tryon") {
    // No image URL in demo mode — the client renders its labeled
    // approximation over the user's own uploaded photo.
    return { state: "success", payload: DEMO_TRYON_RESPONSE };
  }
  return { state: "success", payload: DEMO_TASK_RESPONSE };
}

/**
 * A complete, realistic GET-task response in demo form. Concern scores tell
 * a coherent story: dry, tired-looking skin (moisture weakest, then dark
 * circles and pores) on otherwise healthy skin — a very common real profile.
 */
export const DEMO_TASK_RESPONSE = {
  status: 200,
  data: {
    task_status: "success",
    results: {
      score_info: {
        moisture: { raw_score: 41.26, ui_score: 58, output_mask_name: "moisture_output.png" },
        dark_circle_v2: { raw_score: 52.84, ui_score: 61, output_mask_name: "dark_circle_v2_output.png" },
        pore: { raw_score: 55.31, ui_score: 63, output_mask_name: "pore_output.png" },
        wrinkle: { raw_score: 58.92, ui_score: 66, output_mask_name: "wrinkle_output.png" },
        radiance: { raw_score: 61.47, ui_score: 68, output_mask_name: "radiance_output.png" },
        oiliness: { raw_score: 64.03, ui_score: 70, output_mask_name: "oiliness_output.png" },
        texture: { raw_score: 66.58, ui_score: 72, output_mask_name: "texture_output.png" },
        redness: { raw_score: 69.12, ui_score: 74, output_mask_name: "redness_output.png" },
        eye_bag: { raw_score: 71.66, ui_score: 76, output_mask_name: "eye_bag_output.png" },
        age_spot: { raw_score: 74.95, ui_score: 78, output_mask_name: "age_spot_output.png" },
        acne: { raw_score: 79.41, ui_score: 81, output_mask_name: "acne_output.png" },
        firmness: { raw_score: 82.87, ui_score: 83, output_mask_name: "firmness_output.png" },
        all: { score: 70.58 },
        skin_age: 31,
      },
    },
  },
} as const;

/**
 * A realistic skin-tone-analysis success payload in the documented shape
 * (GET /s2s/v2.0/task/skin-tone-analysis/<task_id>): results.face_quality
 * plus results.color carrying hex colours and colour names. Skin colour
 * #b9947c is the docs' own example value — medium depth, warm undertone —
 * so demo shade matching lands mid-catalogue.
 */
export const DEMO_TONE_RESPONSE = {
  status: 200,
  data: {
    task_status: "success",
    results: {
      face_quality: {
        has_face: true,
        area: "good",
        frontal: "good",
        lighting: "good",
        faceangle: "good",
      },
      color: {
        eye_color: "#4a3226",
        eye_color_name: "Brown",
        eyebrow_color: "#3a2a20",
        lip_color: "#b26a5e",
        skin_color: "#b9947c",
        hair_color: "#2e2019",
        hair_color_name: "Black",
      },
    },
  },
} as const;

/** Demo try-on success marker — intentionally carries no image URL. */
export const DEMO_TRYON_RESPONSE = {
  status: 200,
  data: {
    task_status: "success",
    demo: true,
    results: {},
  },
} as const;
