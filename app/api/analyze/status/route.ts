import { NextResponse } from "next/server";
import { getSkinAnalysisTask, YouCamError } from "@/lib/youcam";
import { getDemoTaskState, isDemoTask } from "@/lib/demo";
import { normalizeYouCamResult } from "@/lib/normalize";


/**
 * GET /api/analyze/status?taskId=<id>
 * Polls YouCam for the task state. On success, the raw payload is run
 * through the normalizer and returned in the app's SkinAnalysisResult
 * shape. Demo tasks resolve through lib/demo.ts with the same contract:
 *   { status: "running" }
 *   { status: "success", result: SkinAnalysisResult }
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

  // Demo tasks live in-memory; real tasks go to Perfect Corp.
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
    return NextResponse.json({
      status: "success",
      result: normalizeYouCamResult(state.payload, "demo"),
    });
  }

  try {
    const state = await getSkinAnalysisTask(taskId);
    if (state.state === "running") return NextResponse.json({ status: "running" });
    if (state.state === "error") {
      return NextResponse.json({
        status: "error",
        error: state.message,
        code: state.code,
      });
    }
    return NextResponse.json({
      status: "success",
      result: normalizeYouCamResult(state.payload, "youcam"),
    });
  } catch (err) {
    if (err instanceof YouCamError) {
      return NextResponse.json(
        { status: "error", error: err.message, code: err.code },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { status: "error", error: "Could not check the analysis status. Please try again." },
      { status: 500 }
    );
  }
}
