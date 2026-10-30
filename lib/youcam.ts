/**
 * YouCam API — server-side client (V2 flow) for the three Perfect Corp
 * features GlowCart uses:
 *
 *   - "skin-analysis"      AI Skin Analysis (scores, skin age, concerns)
 *   - "skin-tone-analysis" AI Face Skin Tone Analysis (skin/eye/lip/hair
 *                          colours — drives foundation shade matching)
 *   - "makeup-vto"         AI Makeup Virtual Try-On (foundation try-on)
 *
 * ALL calls to Perfect Corp happen here, on the server only. The API key is
 * read from process.env.YOUCAM_API_KEY and sent as a Bearer token. The key
 * is never exposed to the browser.
 *
 * Documented V2 flow (https://yce.perfectcorp.com/document/index.html):
 *
 *  1. POST {BASE}/s2s/v2.0/file/<feature>
 *     body: { "files": [{ "content_type", "file_name", "file_size" }] }
 *     ->   { "status": 200, "data": { "files": [{ "file_id",
 *              "requests": [{ "method": "PUT", "url": "<pre-signed S3 URL>",
 *                             "headers": { "Content-Type": ..., ... } }] }] } }
 *
 *  2. PUT the raw image bytes to the pre-signed URL with the returned
 *     headers. (The File API only *initializes* the upload — skipping this
 *     step makes later calls fail with 500/404.)
 *
 *  3. POST {BASE}/s2s/v2.0/task/<feature>   (feature-specific body, below)
 *     ->   { "status": 200, "data": { "task_id": "..." } }
 *
 *  4. GET  {BASE}/s2s/v2.0/task/<feature>/<task_id>
 *     Poll until data.task_status is "success" or "error".
 *
 * Feature task bodies:
 *  - skin-analysis:      { "src_file_id", "dst_actions": [...SD concerns],
 *                          "miniserver_args": { "enable_mask_overlay": true },
 *                          "format": "json" }
 *  - skin-tone-analysis: { "src_file_id",
 *                          "face_angle_strictness_level": "high" }
 *    Success payload: data.results.color = { skin_color: "#b9947c",
 *      eye_color, eye_color_name, lip_color, eyebrow_color, hair_color,
 *      hair_color_name } plus data.results.face_quality.
 *  - makeup-vto:         { "src_file_id", "version": "1.0",
 *                          "effects": [ { "category": "foundation",
 *                            "palettes": [{ "color": "#RRGGBB",
 *                              "colorIntensity": 55, "glowIntensity": 35,
 *                              "coverageIntensity": 60 }] }, ... ] }
 *    Success payload: data.results.url is the processed image URL
 *    (the schema also documents results as [{ "download_url" }] — the
 *    normalizer in this file's extractTryOnImageUrl tolerates both).
 *
 * DEMO MODE: when YOUCAM_API_KEY is empty/absent, isDemoMode() is true and
 * the route handlers use the realistic sample payloads in lib/demo.ts
 * instead of calling Perfect Corp — the full flow still works end-to-end.
 */

const BASE_URL = (
  process.env.YOUCAM_API_BASE_URL ?? "https://yce-api-01.makeupar.com"
).replace(/\/$/, "");

export const FEATURE_SKIN_ANALYSIS = "skin-analysis";
export const FEATURE_SKIN_TONE = "skin-tone-analysis";
export const FEATURE_MAKEUP_VTO = "makeup-vto";

/**
 * SD skin-concern actions requested from the API (docs: SD and HD actions
 * must never be mixed in one request). These map 1:1 onto the app's
 * canonical concerns in lib/normalize.ts.
 */
export const SKIN_ACTIONS = [
  "wrinkle",
  "acne",
  "pore",
  "texture",
  "moisture",
  "oiliness",
  "redness",
  "dark_circle_v2",
  "eye_bag",
  "firmness",
  "radiance",
  "age_spot",
] as const;

/** True when no API key is configured — the app runs in demo mode. */
export function isDemoMode(): boolean {
  return !process.env.YOUCAM_API_KEY;
}

export class YouCamError extends Error {
  code: string;
  httpStatus: number;
  constructor(message: string, code = "youcam_error", httpStatus = 502) {
    super(message);
    this.name = "YouCamError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/** Friendly, user-facing copy for documented YouCam error codes. */
const FRIENDLY_ERRORS: Record<string, string> = {
  error_no_face:
    "We couldn't find a face in that photo. Try a front-facing selfie with your whole face in frame.",
  error_multiple_people:
    "That photo seems to have more than one person in it. This needs a solo selfie.",
  error_src_face_too_small:
    "Your face is a bit small in that photo. Move closer so your face fills most of the frame.",
  error_src_face_out_of_bound:
    "Part of your face is cut off. Retake the photo with your whole face inside the frame.",
  error_face_position_invalid:
    "Please ensure your entire face is fully visible and centred in the photo.",
  error_face_position_too_small:
    "The detected face is too small. Move closer to the camera and try again.",
  error_face_position_out_of_boundary:
    "Your face extends beyond the photo's edges. Move back slightly so your whole face fits.",
  error_face_not_forward_facing:
    "Your face needs to point straight at the camera for an accurate read.",
  error_face_angle_invalid:
    "Your face is angled too far. Look straight at the camera and try again.",
  error_lighting_dark:
    "That photo is too dark to read your skin. Try again facing a window or in brighter light.",
  error_below_min_image_size:
    "That image is too small. Please use a sharper, higher-resolution photo.",
  error_exceed_max_image_size:
    "That image is larger than the service limit. Please try a smaller photo.",
  exceed_max_filesize:
    "That file is too large (10 MB max). Please try a smaller photo.",
  error_large_face_angle:
    "Your face is turned too far to the side. Look straight at the camera and try again.",
  error_decode_image:
    "We couldn't read that image file. Please try a JPG or PNG photo.",
  invalid_parameter:
    "The request was rejected. Please try a different photo.",
  unknown_internal_error:
    "The YouCam service hit a snag. Please try again in a moment.",
};

export function friendlyError(code: string | undefined, fallback: string): string {
  if (code && FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code];
  return fallback;
}

function apiKey(): string {
  const key = process.env.YOUCAM_API_KEY;
  if (!key) {
    throw new YouCamError(
      "YOUCAM_API_KEY is not configured on the server.",
      "missing_api_key",
      500
    );
  }
  return key;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Parse a YouCam JSON envelope and throw a YouCamError on API-level failure. */
async function parseEnvelope(res: Response): Promise<Record<string, unknown>> {
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  const body = (json ?? {}) as Record<string, unknown>;
  const status = typeof body.status === "number" ? body.status : res.status;
  if (!res.ok || status >= 400) {
    const code =
      (typeof body.error_code === "string" && body.error_code) ||
      (typeof body.error === "string" && body.error) ||
      "youcam_error";
    const message =
      (typeof body.error === "string" && body.error) ||
      `YouCam API request failed (HTTP ${res.status}).`;
    throw new YouCamError(
      friendlyError(code, message),
      code,
      res.status >= 400 ? res.status : 502
    );
  }
  return body;
}

/* ------------------------------------------------------------------ */
/* Step 1 + 2: initialize upload, then PUT bytes to the pre-signed URL */
/* ------------------------------------------------------------------ */

interface UploadInit {
  fileId: string;
  uploadMethod: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
}

export async function initFileUpload(
  feature: string,
  fileName: string,
  contentType: string,
  fileSize: number
): Promise<UploadInit> {
  const res = await fetch(`${BASE_URL}/s2s/v2.0/file/${feature}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      files: [
        {
          content_type: contentType,
          file_name: fileName,
          file_size: fileSize,
        },
      ],
    }),
  });
  const body = await parseEnvelope(res);
  const data = body.data as Record<string, unknown> | undefined;
  const files = Array.isArray(data?.files) ? data.files : [];
  const file = (files[0] ?? {}) as Record<string, unknown>;
  const requests = Array.isArray(file.requests) ? file.requests : [];
  const req = (requests[0] ?? {}) as Record<string, unknown>;

  const fileId = typeof file.file_id === "string" ? file.file_id : "";
  const uploadUrl = typeof req.url === "string" ? req.url : "";
  if (!fileId || !uploadUrl) {
    throw new YouCamError(
      "The upload service did not return an upload destination. Please try again.",
      "bad_upload_init"
    );
  }
  const headers: Record<string, string> = {};
  if (req.headers && typeof req.headers === "object") {
    for (const [k, v] of Object.entries(req.headers as Record<string, unknown>)) {
      if (typeof v === "string") headers[k] = v;
      else if (typeof v === "number") headers[k] = String(v);
    }
  }
  if (!headers["Content-Type"] && contentType) {
    headers["Content-Type"] = contentType;
  }
  return {
    fileId,
    uploadMethod: typeof req.method === "string" ? req.method : "PUT",
    uploadUrl,
    uploadHeaders: headers,
  };
}

export async function uploadFileBytes(
  init: UploadInit,
  bytes: Buffer
): Promise<void> {
  const res = await fetch(init.uploadUrl, {
    method: init.uploadMethod,
    headers: init.uploadHeaders,
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    throw new YouCamError(
      "Uploading your photo failed. Please check your connection and try again.",
      "error_upload",
      502
    );
  }
}

/** Upload an image for a feature and return its YouCam file_id. */
async function uploadForFeature(
  feature: string,
  image: Buffer,
  contentType: string,
  fileName: string
): Promise<string> {
  const init = await initFileUpload(feature, fileName, contentType, image.byteLength);
  await uploadFileBytes(init, image);
  return init.fileId;
}

/* ------------------------------------------------------------------ */
/* Step 3 + 4: create a task, then poll it (generic across features)   */
/* ------------------------------------------------------------------ */

async function createTask(
  feature: string,
  body: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`${BASE_URL}/s2s/v2.0/task/${feature}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const parsed = await parseEnvelope(res);
  const data = parsed.data as Record<string, unknown> | undefined;
  const taskId = typeof data?.task_id === "string" ? data.task_id : "";
  if (!taskId) {
    throw new YouCamError(
      "The service did not return a task id. Please try again.",
      "bad_task_create"
    );
  }
  return taskId;
}

export type TaskState =
  | { state: "running" }
  | { state: "success"; payload: unknown }
  | { state: "error"; message: string; code: string };

async function getTask(feature: string, taskId: string): Promise<TaskState> {
  const res = await fetch(
    `${BASE_URL}/s2s/v2.0/task/${feature}/${encodeURIComponent(taskId)}`,
    { method: "GET", headers: authHeaders() }
  );
  const body = await parseEnvelope(res);
  const data = (body.data ?? {}) as Record<string, unknown>;
  const status = typeof data.task_status === "string" ? data.task_status : "";

  if (status === "success") return { state: "success", payload: body };
  if (status === "error") {
    const code =
      (typeof data.error_code === "string" && data.error_code) ||
      (typeof data.error === "string" && data.error) ||
      "error_inference";
    const rawMessage =
      (typeof data.error_message === "string" && data.error_message) ||
      (typeof data.failure_reason === "string" && data.failure_reason) ||
      (typeof data.error === "string" && data.error) ||
      "The task could not be completed for that photo.";
    return { state: "error", message: friendlyError(code, rawMessage), code };
  }
  return { state: "running" };
}

/* ------------------------------------------------------------------ */
/* Feature: AI Skin Analysis                                           */
/* ------------------------------------------------------------------ */

export async function startSkinAnalysis(
  image: Buffer,
  contentType: string,
  fileName: string
): Promise<string> {
  const fileId = await uploadForFeature(FEATURE_SKIN_ANALYSIS, image, contentType, fileName);
  return createTask(FEATURE_SKIN_ANALYSIS, {
    src_file_id: fileId,
    dst_actions: [...SKIN_ACTIONS],
    miniserver_args: {
      enable_mask_overlay: true,
    },
    format: "json",
  });
}

export function getSkinAnalysisTask(taskId: string): Promise<TaskState> {
  return getTask(FEATURE_SKIN_ANALYSIS, taskId);
}

/* ------------------------------------------------------------------ */
/* Feature: AI Skin Tone Analysis                                      */
/* ------------------------------------------------------------------ */

/**
 * Documented task body (Inputs & Outputs, AI Skin Tone Analysis):
 *   { "src_file_id": "<file_id>",
 *     "face_angle_strictness_level": "high" }
 * face_angle_strictness_level is an enum: strict | high | medium | low |
 * flexible; "high" is the documented default.
 */
export async function startSkinToneAnalysis(
  image: Buffer,
  contentType: string,
  fileName: string
): Promise<string> {
  const fileId = await uploadForFeature(FEATURE_SKIN_TONE, image, contentType, fileName);
  return createTask(FEATURE_SKIN_TONE, {
    src_file_id: fileId,
    face_angle_strictness_level: "high",
  });
}

export function getSkinToneAnalysisTask(taskId: string): Promise<TaskState> {
  return getTask(FEATURE_SKIN_TONE, taskId);
}

/* ------------------------------------------------------------------ */
/* Feature: AI Makeup Virtual Try-On (foundation)                      */
/* ------------------------------------------------------------------ */

/**
 * Build the documented makeup-vto effects payload for a foundation shade.
 * Foundation effect schema (Makeup Effect Schema → `foundation`):
 *   { "category": "foundation",
 *     "palettes": [{ "color": "#RRGGBB", "colorIntensity": 0..100,
 *                    "glowIntensity": 0..100, "coverageIntensity": 0..100 }] }
 * A gentle skin_smooth effect rides along — docs note the engine applies
 * a default of 50 when it's omitted; we set a lighter touch explicitly so
 * the foundation colour stays true.
 */
export function foundationEffects(shadeHex: string): Record<string, unknown>[] {
  return [
    {
      category: "skin_smooth",
      skinSmoothStrength: 35,
      skinSmoothColorIntensity: 30,
    },
    {
      category: "foundation",
      palettes: [
        {
          color: shadeHex,
          colorIntensity: 55,
          glowIntensity: 35,
          coverageIntensity: 60,
        },
      ],
    },
  ];
}

/**
 * Documented task body (AI Makeup VTO → Start Makeup Task):
 *   { "src_file_id": "<file_id>", "version": "1.0", "effects": [...] }
 * (The docs' example posts src_file_url; src_file_id is the equivalent
 * File-API form used by every V2 feature.)
 */
export async function startMakeupTryOn(
  image: Buffer,
  contentType: string,
  fileName: string,
  shadeHex: string
): Promise<string> {
  const fileId = await uploadForFeature(FEATURE_MAKEUP_VTO, image, contentType, fileName);
  return createTask(FEATURE_MAKEUP_VTO, {
    src_file_id: fileId,
    version: "1.0",
    effects: foundationEffects(shadeHex),
  });
}

export function getMakeupTryOnTask(taskId: string): Promise<TaskState> {
  return getTask(FEATURE_MAKEUP_VTO, taskId);
}

/**
 * Pull the processed-image URL out of a makeup-vto success payload.
 * Documented shapes:
 *   data.results = { "url": "https://.../processed.jpg" }   (example)
 *   data.results = [{ "download_url": "https://..." }]      (schema text)
 * Tolerates both, plus a top-level results.output-style array.
 */
export function extractTryOnImageUrl(payload: unknown): string | null {
  const isRec = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  const fromRecord = (r: Record<string, unknown>): string | null => {
    for (const key of ["url", "download_url", "image_url", "dst_url"]) {
      if (typeof r[key] === "string" && r[key]) return r[key] as string;
    }
    return null;
  };
  if (!isRec(payload)) return null;
  const data = isRec(payload.data) ? payload.data : payload;
  const results = (data as Record<string, unknown>).results;
  if (typeof results === "string") return results;
  if (Array.isArray(results)) {
    for (const item of results) {
      if (typeof item === "string") return item;
      if (isRec(item)) {
        const u = fromRecord(item);
        if (u) return u;
      }
    }
    return null;
  }
  if (isRec(results)) {
    const direct = fromRecord(results);
    if (direct) return direct;
    if (Array.isArray(results.output)) {
      for (const item of results.output) {
        if (isRec(item)) {
          const u = fromRecord(item);
          if (u) return u;
        }
      }
    }
  }
  return null;
}
