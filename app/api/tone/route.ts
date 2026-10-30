import { NextResponse } from "next/server";
import {
  isDemoMode,
  startSkinToneAnalysis,
  friendlyError,
  YouCamError,
} from "@/lib/youcam";
import { createDemoTask } from "@/lib/demo";

export const maxDuration = 60;

const MAX_BYTES = 9.5 * 1024 * 1024; // YouCam limit is 10 MB
const ACCEPTED = new Set(["image/jpeg", "image/png"]);

/**
 * POST /api/tone
 * Multipart form with a single "image" file — the same selfie used for
 * skin analysis. Uploads it to YouCam (server-side only) and starts a
 * skin-tone-analysis task, returning its id. The tone result drives
 * foundation shade matching. In demo mode it returns a demo task id —
 * the client polls /api/tone/status exactly the same way either way.
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

  if (isDemoMode()) {
    return NextResponse.json({ taskId: createDemoTask("tone"), demo: true });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const taskId = await startSkinToneAnalysis(
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
      { error: "Something went wrong starting the tone analysis. Please try again." },
      { status: 500 }
    );
  }
}
