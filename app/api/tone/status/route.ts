import { NextResponse } from "next/server";
import { getSkinToneAnalysisTask, YouCamError } from "@/lib/youcam";
import { getDemoTaskState, isDemoTask } from "@/lib/demo";
import { normalizeSkinToneResult } from "@/lib/normalize";

/**
 * GET /api/tone/status?taskId=<id>
 * Polls YouCam for the skin-tone task state. On success the raw payload
 * is normalized (documented color block -> SkinToneResult with derived
 * depth/undertone) and returned:
 *   { status: "running" }
 *   { status: "success", result: SkinToneResult }
 *   { status: "error", error: string, code?: string }
 */
export async function GET(request: Request) {
  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json(
      { status: "error", error: "Missing task id." },
      { status: 400 }
    );
  }

  const noTone = {
    status: "error",
    error:
      "We couldn't read a skin tone from that photo. Try a front-facing selfie in bright, even light.",
  };

  if (isDemoTask(taskId)) {
    const state = getDemoTaskState(taskId);
    if (state.state === "running") return NextResponse.json({ status: "running" });
    if (state.state === "error") {
      return NextResponse.json({
        status: "error",
        error: state.message,
        code: state.code,
      });
    }
    const result = normalizeSkinToneResult(state.payload, "demo");
    if (!result) return NextResponse.json(noTone, { status: 422 });
    return NextResponse.json({ status: "success", result });
  }

  try {
    const state = await getSkinToneAnalysisTask(taskId);
    if (state.state === "running") return NextResponse.json({ status: "running" });
    if (state.state === "error") {
      return NextResponse.json({
        status: "error",
        error: state.message,
        code: state.code,
      });
    }
    const result = normalizeSkinToneResult(state.payload, "youcam");
    if (!result) return NextResponse.json(noTone, { status: 422 });
    return NextResponse.json({ status: "success", result });
  } catch (err) {
    if (err instanceof YouCamError) {
      return NextResponse.json(
        { status: "error", error: err.message, code: err.code },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { status: "error", error: "Could not check the tone status. Please try again." },
      { status: 500 }
    );
  }
}
