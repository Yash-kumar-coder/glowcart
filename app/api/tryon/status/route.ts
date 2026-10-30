import { NextResponse } from "next/server";
import {
  getMakeupTryOnTask,
  extractTryOnImageUrl,
  YouCamError,
} from "@/lib/youcam";
import { getDemoTaskState, isDemoTask } from "@/lib/demo";

/**
 * GET /api/tryon/status?taskId=<id>
 * Polls YouCam for the makeup-vto task state:
 *   { status: "running" }
 *   { status: "success", demo: false, imageUrl: string }   live result image
 *   { status: "success", demo: true,  imageUrl: null }     demo — the client
 *     renders a labeled approximation over the user's own photo
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
    return NextResponse.json({ status: "success", demo: true, imageUrl: null });
  }

  try {
    const state = await getMakeupTryOnTask(taskId);
    if (state.state === "running") return NextResponse.json({ status: "running" });
    if (state.state === "error") {
      return NextResponse.json({
        status: "error",
        error: state.message,
        code: state.code,
      });
    }
    const imageUrl = extractTryOnImageUrl(state.payload);
    if (!imageUrl) {
      return NextResponse.json(
        {
          status: "error",
          error: "The try-on finished but returned no image. Please try again.",
        },
        { status: 422 }
      );
    }
    return NextResponse.json({ status: "success", demo: false, imageUrl });
  } catch (err) {
    if (err instanceof YouCamError) {
      return NextResponse.json(
        { status: "error", error: err.message, code: err.code },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { status: "error", error: "Could not check the try-on status. Please try again." },
      { status: 500 }
    );
  }
}
