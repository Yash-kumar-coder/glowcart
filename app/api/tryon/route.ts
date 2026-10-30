import { NextResponse } from "next/server";
import {
  isDemoMode,
  startMakeupTryOn,
  friendlyError,
  YouCamError,
} from "@/lib/youcam";
import { createDemoTask } from "@/lib/demo";

export const maxDuration = 60;

const MAX_BYTES = 9.5 * 1024 * 1024; // YouCam limit is 10 MB
const ACCEPTED = new Set(["image/jpeg", "image/png"]);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * POST /api/tryon
 * Multipart form: "image" (the user's selfie) + "shadeHex" (the matched
 * foundation shade colour, e.g. "#bd9673"). Starts a YouCam makeup-vto
 * task that applies that exact foundation shade to the user's own photo.
 * In demo mode it returns a demo task id — the client polls
 * /api/tryon/status the same way, and renders its labeled approximation
 * because a demo try-on carries no result image.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Please upload a photo for the try-on." },
      { status: 400 }
    );
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No photo was provided for the try-on." },
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

  const shadeHex = form.get("shadeHex");
  if (typeof shadeHex !== "string" || !HEX_RE.test(shadeHex)) {
    return NextResponse.json(
      { error: "Please pick a foundation shade to try on first." },
      { status: 400 }
    );
  }

  if (isDemoMode()) {
    return NextResponse.json({ taskId: createDemoTask("tryon"), demo: true });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const taskId = await startMakeupTryOn(
      bytes,
      file.type,
      file.name || "selfie.jpg",
      shadeHex
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
      { error: "Something went wrong starting the try-on. Please try again." },
      { status: 500 }
    );
  }
}
