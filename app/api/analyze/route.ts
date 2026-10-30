import { NextResponse } from "next/server";
import {
  isDemoMode,
  startSkinAnalysis,
  friendlyError,
  YouCamError,
} from "@/lib/youcam";
import { createDemoTask } from "@/lib/demo";

// Note: no `runtime`/`dynamic` segment exports — this project's Next config
// enables cacheComponents, which manages those itself. Route handlers are
// dynamic by default.
export const maxDuration = 60;

const MAX_BYTES = 9.5 * 1024 * 1024; // YouCam limit is 10 MB
const ACCEPTED = new Set(["image/jpeg", "image/png"]);

/**
 * POST /api/analyze
 * Multipart form with a single "image" file. Uploads the photo to YouCam
 * (server-side only), creates a skin-analysis task and returns its id.
 * In demo mode (no YOUCAM_API_KEY) it returns a demo task id instead —
 * the client polls /api/analyze/status exactly the same way either way.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Please upload a photo to analyze." },
      { status: 400 }
    );
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No photo was provided. Please choose or take a selfie." },
      { status: 400 }
    );
  }
  if (!ACCEPTED.has(file.type)) {
    return NextResponse.json(
      {
        error: friendlyError(
          "error_decode_image",
          "That file type isn't supported. Please use a JPG or PNG photo."
        ),
      },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: friendlyError(
          "exceed_max_filesize",
          "That photo is too large (10 MB max)."
        ),
      },
      { status: 400 }
    );
  }

  // Demo mode: no key configured — fake the task, same client flow.
  if (isDemoMode()) {
    return NextResponse.json({ taskId: createDemoTask(), demo: true });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const taskId = await startSkinAnalysis(
      bytes,
      file.type,
      file.name || "selfie.jpg"
    );
    return NextResponse.json({ taskId, demo: false });
  } catch (err) {
    if (err instanceof YouCamError) {
      const status = err.httpStatus >= 400 && err.httpStatus < 600 ? 422 : 502;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status }
      );
    }
    return NextResponse.json(
      { error: "Something went wrong starting the analysis. Please try again." },
      { status: 500 }
    );
  }
}
