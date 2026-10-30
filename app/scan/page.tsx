"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SkinAnalysisResult, SkinToneResult } from "@/lib/normalize";
import ScoreGauge from "@/components/ScoreGauge";
import ConcernBars from "@/components/ConcernBars";
import RoutineBuilder from "@/components/RoutineBuilder";
import ShadeMatchSection from "@/components/ShadeMatch";
import AdvisorPanel from "@/components/AdvisorPanel";
import ManualRoutine from "@/components/ManualRoutine";
import { buildRoutine, type RoutinePick } from "@/lib/recommend";
import { matchShades, shadeToProduct, type ShadeMatch } from "@/lib/shades";

type Phase = "capture" | "analyzing" | "done" | "error";
type ToneStatus = "idle" | "running" | "error" | "done";

const PROGRESS_STEPS = [
  "Uploading your photo securely…",
  "Finding your face and mapping landmarks…",
  "Scoring moisture, pores, wrinkles and 9 more concerns…",
  "Reading your skin tone and matching your foundation shade…",
];

const PHOTO_TIPS = [
  "Face the camera straight on, hair off your forehead",
  "Use bright, even light — face a window if you can",
  "Remove glasses and makeup for the most accurate read",
  "Fill most of the frame with your face",
];

/** Downscale + re-encode an image client-side before upload. */
async function compressImage(source: Blob): Promise<Blob> {
  const url = URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return source;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88)
    );
    return blob ?? source;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ScanPage() {
  const [phase, setPhase] = useState<Phase>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<SkinAnalysisResult | null>(null);
  const [tone, setTone] = useState<SkinToneResult | null>(null);
  const [toneStatus, setToneStatus] = useState<ToneStatus>("idle");
  const [toneError, setToneError] = useState("");
  const [budget, setBudget] = useState<number>(200);
  const [foundationPick, setFoundationPick] = useState<RoutinePick | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [faceStable, setFaceStable] = useState<boolean | null>(null);

  const stabilityRef = useRef<{ prev: Float32Array | null; calm: number }>({
    prev: null,
    calm: 0,
  });
  const [dragOver, setDragOver] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  // Skin-scan timers only. The tone poll runs on its own timer and must
  // NOT be cancelled when the skin scan finishes first (or vice versa).
  const cleanupTimers = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    if (stepTimer.current) clearInterval(stepTimer.current);
    pollTimer.current = null;
    stepTimer.current = null;
  }, []);

  const clearToneTimer = useCallback(() => {
    if (toneTimer.current) clearTimeout(toneTimer.current);
    toneTimer.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupTimers();
      clearToneTimer();
      stopCamera();
    };
  }, [cleanupTimers, clearToneTimer, stopCamera]);

  // Live face-stability hint for the camera view: sample a tiny center
  // crop of the video a few times a second and measure frame-to-frame
  // change. A still, well-framed face barely changes between samples;
  // movement spikes the difference. Purely guidance — capture is never
  // blocked, it just tells the user when the shot is steady enough for
  // the most accurate scan.
  useEffect(() => {
    if (!cameraOn) {
      setFaceStable(null);
      stabilityRef.current = { prev: null, calm: 0 };
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const id = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const s = Math.min(vw, vh);
      ctx.drawImage(video, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;
      const lum = new Float32Array(32 * 32);
      for (let i = 0; i < 32 * 32; i++) {
        lum[i] =
          data[i * 4] * 0.34 + data[i * 4 + 1] * 0.5 + data[i * 4 + 2] * 0.16;
      }
      const prev = stabilityRef.current.prev;
      if (prev) {
        let diff = 0;
        for (let i = 0; i < lum.length; i++) diff += Math.abs(lum[i] - prev[i]);
        diff /= lum.length;
        stabilityRef.current.calm =
          diff < 6 ? stabilityRef.current.calm + 1 : 0;
        setFaceStable(stabilityRef.current.calm >= 2);
      }
      stabilityRef.current.prev = lum;
    }, 300);
    return () => clearInterval(id);
  }, [cameraOn]);

  const acceptImage = useCallback(async (file: Blob) => {
    const compressed = await compressImage(file);
    setImageBlob(compressed);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(compressed);
    });
    setError("");
  }, []);

  const onFilePicked = async (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Please choose a JPG or PNG photo.");
      return;
    }
    stopCamera();
    await acceptImage(file);
  };

  const attachStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    requestAnimationFrame(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
    });
  }, []);

  const startCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 1600 },
        },
        audio: false,
      });
      setCameraOn(true);
      attachStream(stream);
    } catch {
      setCameraError(
        "Camera access was blocked. You can still upload a photo instead."
      );
    }
  };

  /** Flip between the front and back cameras. The current stream keeps
   *  running until the new one is confirmed, so a device with a single
   *  camera just shows a note instead of losing the view. Front camera
   *  is mirrored (selfie view); the back camera is not. */
  const flipCamera = async () => {
    const next = facing === "user" ? "environment" : "user";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: next },
          width: { ideal: 1280 },
          height: { ideal: 1600 },
        },
        audio: false,
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setFacing(next);
      setCameraError("");
      attachStream(stream);
    } catch {
      setCameraError("This device has no second camera to flip to.");
    }
  };

  const captureFromCamera = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror only the front (selfie) camera so it looks natural; the
    // back camera is captured as-is.
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    stopCamera();
    if (blob) await acceptImage(blob);
  };

  const pollStatus = useCallback((taskId: string, attempts: number) => {
    pollTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/analyze/status?taskId=${encodeURIComponent(taskId)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as {
          status?: string;
          result?: SkinAnalysisResult;
          error?: string;
        };
        if (json.status === "success" && json.result) {
          cleanupTimers();
          setResult(json.result);
          setPhase("done");
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (json.status === "error" || !res.ok) {
          cleanupTimers();
          setError(
            json.error ??
              "The analysis could not be completed. Please try another photo."
          );
          setPhase("error");
          return;
        }
        if (attempts > 48) {
          cleanupTimers();
          setError(
            "The analysis is taking much longer than usual. Please try again in a moment."
          );
          setPhase("error");
          return;
        }
        pollStatus(taskId, attempts + 1);
      } catch {
        if (attempts > 48) {
          cleanupTimers();
          setError("We lost the connection while analyzing. Please try again.");
          setPhase("error");
          return;
        }
        pollStatus(taskId, attempts + 1);
      }
    }, 2500);
  }, [cleanupTimers]);

  const pollTone = useCallback((taskId: string, attempts: number) => {
    toneTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/tone/status?taskId=${encodeURIComponent(taskId)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as {
          status?: string;
          result?: SkinToneResult;
          error?: string;
        };
        if (json.status === "success" && json.result) {
          setTone(json.result);
          setToneStatus("done");
          return;
        }
        if (json.status === "error" || !res.ok) {
          setToneError(json.error ?? "Tone analysis failed.");
          setToneStatus("error");
          return;
        }
        if (attempts > 48) {
          setToneError("Tone analysis timed out.");
          setToneStatus("error");
          return;
        }
        pollTone(taskId, attempts + 1);
      } catch {
        if (attempts > 48) {
          setToneError("Tone analysis connection lost.");
          setToneStatus("error");
          return;
        }
        pollTone(taskId, attempts + 1);
      }
    }, 2500);
  }, []);

  /** Run Skin Tone Analysis on the same selfie, in parallel with the skin scan. */
  const startToneAnalysis = useCallback(
    async (blob: Blob) => {
      setToneStatus("running");
      setToneError("");
      try {
        const form = new FormData();
        form.append(
          "image",
          new File([blob], "selfie.jpg", { type: "image/jpeg" })
        );
        const res = await fetch("/api/tone", { method: "POST", body: form });
        const json = (await res.json()) as { taskId?: string; error?: string };
        if (!res.ok || !json.taskId) {
          setToneError(json.error ?? "Could not start tone analysis.");
          setToneStatus("error");
          return;
        }
        pollTone(json.taskId, 0);
      } catch {
        setToneError("Could not reach the tone analysis service.");
        setToneStatus("error");
      }
    },
    [pollTone]
  );

  const startAnalysis = async () => {
    if (!imageBlob) return;
    setPhase("analyzing");
    setProgressStep(0);
    setError("");
    setTone(null);
    setToneStatus("idle");
    setFoundationPick(null);
    stepTimer.current = setInterval(() => {
      setProgressStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1));
    }, 3000);
    // Skin Tone Analysis runs on the same selfie, in parallel — its result
    // powers the shade-match section of the report.
    void startToneAnalysis(imageBlob);
    try {
      const form = new FormData();
      form.append(
        "image",
        new File([imageBlob], "selfie.jpg", { type: "image/jpeg" })
      );
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const json = (await res.json()) as { taskId?: string; error?: string };
      if (!res.ok || !json.taskId) {
        cleanupTimers();
        setError(json.error ?? "Could not start the analysis. Please try again.");
        setPhase("error");
        return;
      }
      pollStatus(json.taskId, 0);
    } catch {
      cleanupTimers();
      setError("We couldn't reach the analysis service. Check your connection and try again.");
      setPhase("error");
    }
  };

  const reset = () => {
    cleanupTimers();
    clearToneTimer();
    stopCamera();
    setPhase("capture");
    setResult(null);
    setTone(null);
    setToneStatus("idle");
    setToneError("");
    setFoundationPick(null);
    setManualMode(false);
    setImageBlob(null);
    setError("");
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const routinePicks = useMemo<RoutinePick[]>(() => {
    if (!result) return [];
    const base = buildRoutine(result);
    // A tried-on foundation, once added, leads the routine (priority -1 in
    // the budget walk) — it's an explicit, proven choice by the user.
    return foundationPick ? [foundationPick, ...base] : base;
  }, [result, foundationPick]);

  const shadeMatches = useMemo(
    () => (tone ? matchShades(tone) : []),
    [tone]
  );

  const addFoundation = useCallback((match: ShadeMatch) => {
    setFoundationPick({
      product: shadeToProduct(match.shade),
      forConcern: "shade-match",
      forLabel: `Shade match · ${match.shade.code} ${match.shade.name}`,
      reason: `${match.reason} You tried this exact shade on your own photo before adding it.`,
      priority: -1,
    });
  }, []);

  /* ------------------------------ Results ------------------------------ */
  if (phase === "done" && result) {
    const weakest = result.concerns.slice(0, 3);
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-semibold text-forest">
              Your skin report
            </h1>
            <p className="mt-1 text-sm text-ink/60">
              Analyzed {new Date(result.analyzedAt).toLocaleString()} ·{" "}
              {result.concerns.length} concerns measured
            </p>
          </div>
          <div className="flex items-center gap-2">
            {result.source === "demo" && (
              <span className="rounded-full bg-gold/20 px-3 py-1.5 text-xs font-bold text-gold" title="No YouCam API key is configured, so this is a realistic sample result">
                Demo result — sample data
              </span>
            )}
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-forest/25 px-4 py-2 text-sm font-semibold text-forest transition-colors hover:border-forest/60"
            >
              Scan another photo
            </button>
          </div>
        </div>

        {result.source === "demo" && (
          <p className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink/75">
            You&apos;re seeing a <strong>demo result</strong>: this server has
            no YouCam API key configured, so GlowCart used a realistic sample
            analysis to show the full experience. Add{" "}
            <code className="rounded bg-white/70 px-1 font-mono text-[13px]">YOUCAM_API_KEY</code>{" "}
            to run your photo through the real YouCam AI.
          </p>
        )}

        {/* Score summary */}
        <section className="mt-6 grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="flex flex-col items-center rounded-[2rem] border border-ink/10 bg-white px-6 pb-6 pt-8">
            <ScoreGauge score={result.overallScore} />
            <div className="mt-16 grid w-full grid-cols-2 gap-3 border-t border-ink/8 pt-5 text-center sm:mt-20">
              <div>
                <p className="font-display text-3xl font-semibold text-ink">
                  {result.skinAge ?? "—"}
                  {result.skinAge !== null && result.skinAgeIsEstimate && (
                    <span className="text-base text-ink/45"> est.</span>
                  )}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/50">
                  Estimated skin age
                </p>
              </div>
              <div>
                <p className="font-display text-3xl font-semibold text-ink">
                  {result.concerns.length}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/50">
                  Concerns scored
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-ink/10 bg-white p-6">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Where your skin needs help first
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              Your three weakest concerns drive your routine below:{" "}
              <strong className="text-ink">
                {weakest.map((c) => c.label.toLowerCase()).join(", ")}
              </strong>
              .
            </p>
            <div className="mt-5">
              <ConcernBars concerns={result.concerns} />
            </div>
          </div>
        </section>

        {/* GlowAdvisor */}
        <AdvisorPanel
          skin={result}
          tone={tone}
          picks={routinePicks}
          budget={budget}
          matches={shadeMatches}
        />

        {/* Shade match + virtual try-on */}
        <ShadeMatchSection
          tone={tone}
          toneStatus={toneStatus}
          toneError={toneError}
          previewUrl={previewUrl}
          imageBlob={imageBlob}
          addedShadeId={
            foundationPick
              ? foundationPick.product.id.replace("foundation-", "")
              : null
          }
          onAddFoundation={addFoundation}
        />

        {/* Routine */}
        <section className="mt-10">
          <h2 className="font-display text-3xl font-semibold text-forest">
            Your matched routine
          </h2>
          <p className="mt-1 max-w-2xl text-ink/65">
            Built from your three weakest concerns, plus the cleanser,
            moisturizer and SPF every routine needs — each one chosen to fit
            your skin, and trimmed to your budget. Add your tried-on
            foundation above and it joins this routine and cart.
          </p>
          <div className="mt-6">
            <RoutineBuilder
              picks={routinePicks}
              budget={budget}
              onBudgetChange={setBudget}
            />
          </div>
        </section>
      </div>
    );
  }

  /* --------------------- Manual (no-scan) fallback --------------------- */
  if (manualMode) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <ManualRoutine onBack={() => setManualMode(false)} />
      </div>
    );
  }

  /* --------------------------- Capture / states --------------------------- */
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold text-forest sm:text-5xl">
          Let&apos;s read your skin.
        </h1>
        <p className="mt-3 text-lg text-ink/65">
          One front-facing selfie is all YouCam&apos;s AI needs to score 12
          skin concerns, read your exact skin tone, match your foundation
          shade — and let you try it on before you buy.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        {/* Capture panel */}
        <section className="rounded-[2rem] border border-ink/10 bg-white p-5 sm:p-6">
          {cameraOn ? (
            <div className="relative mx-auto aspect-square w-full max-w-[520px] overflow-hidden rounded-3xl bg-forest">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`aspect-square h-full w-full object-cover ${
                  facing === "user" ? "-scale-x-100" : ""
                }`}
              />
              {/* Flip camera (front ↔ back) */}
              <button
                type="button"
                onClick={flipCamera}
                aria-label="Flip camera"
                title="Flip camera"
                className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full bg-[#14231c]/70 text-cream backdrop-blur transition-colors hover:bg-[#14231c]/90"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6.1" />
                  <path d="M18.6 2.8v4h-4" />
                  <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
                </svg>
              </button>
              {/* Face guide: shadow mask with an oval cutout, so the user
                  frames their whole face inside it for the best scan. */}
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <svg
                  className="h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <mask id="glowcart-face-hole">
                      <rect width="100" height="100" fill="white" />
                      <ellipse cx="50" cy="46" rx="26" ry="36" fill="black" />
                    </mask>
                  </defs>
                  <rect
                    width="100"
                    height="100"
                    fill="rgba(18,28,23,0.52)"
                    mask="url(#glowcart-face-hole)"
                  />
                </svg>
                <div className="absolute left-1/2 top-[46%] h-[72%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[3px] border-[#2fbf71] shadow-[0_0_36px_rgba(47,191,113,0.45)]" />
              </div>
              {/* Framing + stability guidance */}
              <div className="absolute inset-x-0 top-3 flex flex-col items-center gap-1.5 px-4 text-center">
                <span
                  className="rounded-full bg-[#14231c]/85 px-4 py-2 text-xs font-bold text-cream shadow-sm backdrop-blur"
                  role="status"
                >
                  {faceStable === null ? (
                    "Position your face in the oval"
                  ) : faceStable ? (
                    <>
                      <span className="text-[#2fbf71]">✓</span> Perfect —
                      capture now
                    </>
                  ) : (
                    <>
                      <span className="text-[#2fbf71]">✓</span> Hold still…
                    </>
                  )}
                </span>
                <span className="text-[11px] font-semibold text-white/90">
                  Fit your whole face inside the oval and fill most of it
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-forest/80 to-transparent p-4 pt-10">
                <button
                  type="button"
                  onClick={captureFromCamera}
                  className="rounded-full bg-clay px-6 py-3 text-sm font-bold text-white hover:bg-clay-dark"
                >
                  Capture photo
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded-full bg-white/90 px-5 py-3 text-sm font-semibold text-forest hover:bg-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : previewUrl ? (
            <div className="relative overflow-hidden rounded-3xl bg-parchment">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Your selfie, ready for analysis"
                className="max-h-[480px] w-full object-contain"
              />
              {phase === "analyzing" && (
                <>
                  <div className="absolute inset-0 bg-forest/25" />
                  <div className="animate-scanline absolute inset-x-0 h-1 bg-blush shadow-[0_0_24px_6px_rgba(239,201,184,0.8)]" />
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void onFilePicked(e.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex aspect-[4/3] w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 text-center transition-colors ${
                dragOver
                  ? "border-clay bg-blush/25"
                  : "border-ink/20 bg-parchment/50 hover:border-forest/40"
              }`}
            >
              <span className="grid size-14 place-items-center rounded-full bg-white text-2xl shadow-sm">
                📸
              </span>
              <span className="mt-4 font-display text-xl font-semibold text-ink">
                Drop your selfie here, or click to choose
              </span>
              <span className="mt-1 text-sm text-ink/55">
                JPG or PNG, up to 10 MB. Your photo is sent only to the
                YouCam analysis service and isn&apos;t stored by GlowCart.
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              void onFilePicked(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />

          {cameraError && (
            <p className="mt-3 rounded-2xl bg-clay/10 px-4 py-3 text-sm font-medium text-clay-dark" role="alert">
              {cameraError}
            </p>
          )}
          {phase === "error" && (
            <p className="mt-3 rounded-2xl bg-clay/10 px-4 py-3 text-sm font-medium text-clay-dark" role="alert">
              {error}
            </p>
          )}
          {phase === "error" && (
            <div className="mt-3 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink/75">
              <strong>We won&apos;t show you made-up results.</strong> If
              your photo won&apos;t scan, pick your top concerns yourself
              and we&apos;ll build your routine from those instead —
              clearly labeled, no invented scores.{" "}
              <button
                type="button"
                onClick={() => setManualMode(true)}
                className="font-semibold text-forest underline underline-offset-2"
              >
                Pick my concerns →
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="rounded-full bg-forest px-4 py-2 text-xs font-bold text-cream transition-colors hover:bg-pine"
                >
                  ↻ Retake with camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full border border-forest/30 px-4 py-2 text-xs font-bold text-forest transition-colors hover:border-forest/60"
                >
                  Upload a photo instead
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {!cameraOn && !previewUrl && (
              <button
                type="button"
                onClick={startCamera}
                className="rounded-full border border-forest/25 px-5 py-3 text-sm font-semibold text-forest transition-colors hover:border-forest/60"
              >
                Use my camera instead
              </button>
            )}
            {previewUrl && phase !== "analyzing" && (
              <>
                <button
                  type="button"
                  onClick={startAnalysis}
                  className="rounded-full bg-clay px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-clay-dark"
                >
                  Analyze my skin →
                </button>
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="rounded-full px-3 py-3 text-sm font-semibold text-ink/55 underline-offset-2 transition-colors hover:text-forest hover:underline"
                >
                  Photo won&apos;t scan? Pick your concerns instead
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold text-ink/70 transition-colors hover:border-forest/50 hover:text-forest"
                >
                  Choose a different photo
                </button>
              </>
            )}
          </div>

          {phase === "analyzing" && (
            <div className="mt-6" role="status" aria-live="polite">
              <div className="flex items-center gap-3">
                <span className="animate-pulse-soft size-2.5 rounded-full bg-clay" />
                <p className="text-sm font-semibold text-ink">
                  {PROGRESS_STEPS[progressStep]}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand">
                <div
                  className="h-full rounded-full bg-pine transition-all duration-700"
                  style={{
                    width: `${18 + progressStep * 24}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-ink/50">
                This usually takes 15–45 seconds. Keep this tab open.
              </p>
            </div>
          )}
        </section>

        {/* Tips panel */}
        <aside className="h-fit rounded-[2rem] bg-forest p-6 text-cream">
          <h2 className="font-display text-2xl font-semibold">
            For the most accurate scan
          </h2>
          <ul className="mt-4 space-y-3">
            {PHOTO_TIPS.map((tip) => (
              <li key={tip} className="flex gap-3 text-sm leading-relaxed text-cream/85">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-blush/25 text-[11px] font-bold text-blush">
                  ✓
                </span>
                {tip}
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-cream/15 pt-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cream/60">
              What happens next
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-cream/80">
              You&apos;ll get an overall skin score, an estimated skin age,
              and a weakest-first breakdown of 12 concerns — then
              GlowAdvisor&apos;s take on your numbers, your foundation shade
              match with a virtual try-on, and a routine matched to your top
              three concerns, trimmed to your budget.
            </p>
          </div>
          <div className="mt-6 rounded-2xl bg-cream/8 p-4">
            <p className="text-xs leading-relaxed text-cream/70">
              <strong className="text-cream">Privacy:</strong> your photo is
              processed by Perfect Corp&apos;s YouCam API over an encrypted
              connection. GlowCart does not store your photo or your results
              on any server.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
