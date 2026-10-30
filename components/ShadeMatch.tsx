"use client";

import { useEffect, useRef, useState } from "react";
import type { SkinToneResult } from "@/lib/normalize";
import { matchShades, type ShadeMatch } from "@/lib/shades";

type ToneStatus = "idle" | "running" | "error" | "done";
type TryOnPhase = "idle" | "running" | "done" | "error";

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/**
 * Before/after comparison with a drag slider. `afterUrl` is the live
 * YouCam makeup-vto result image; when it's null (demo mode) the "after"
 * side is the user's own photo with a clearly-labeled simulated tint:
 * a soft-light + multiply overlay in the exact shade colour, plus a
 * gentle softening filter.
 */
function TryOnCompare({
  beforeUrl,
  afterUrl,
  shadeHex,
  shadeLabel,
  isDemoRender,
}: {
  beforeUrl: string;
  afterUrl: string | null;
  shadeHex: string;
  shadeLabel: string;
  isDemoRender: boolean;
}) {
  const [pos, setPos] = useState(55);
  return (
    <div>
      <div className="relative select-none overflow-hidden rounded-3xl bg-parchment">
        {/* Before (base layer). Both layers use object-cover at the same
            fixed height so the before/after crop aligns pixel-for-pixel. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt="Your photo before the virtual try-on"
          className="block h-[400px] w-full object-cover sm:h-[500px]"
          draggable={false}
        />
        {/* After (clipped layer) */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          {afterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={afterUrl}
              alt={`Your photo wearing foundation shade ${shadeLabel}`}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={beforeUrl}
                alt=""
                aria-hidden
                className="h-full w-full object-cover"
                style={{
                  filter:
                    "saturate(1.07) brightness(1.03) contrast(0.98) blur(0.4px)",
                }}
                draggable={false}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: shadeHex,
                  mixBlendMode: "soft-light",
                  opacity: 0.65,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: shadeHex,
                  mixBlendMode: "multiply",
                  opacity: 0.07,
                }}
              />
            </>
          )}
        </div>
        {/* Slider handle */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.45)]"
          style={{ left: `${pos}%` }}
        >
          <span className="absolute top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-sm font-bold text-forest shadow-md">
            ↔
          </span>
        </div>
        <span className="absolute left-3 top-3 rounded-full bg-forest/80 px-2.5 py-1 text-[11px] font-bold text-cream">
          After · {shadeLabel}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-forest/80 px-2.5 py-1 text-[11px] font-bold text-cream">
          Before
        </span>
        {isDemoRender && (
          <span className="absolute bottom-3 left-3 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold text-forest">
            Demo try-on — simulated tint, not a live render
          </span>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        className="mt-3 w-full accent-clay"
        aria-label="Reveal the before and after try-on comparison"
      />
    </div>
  );
}

export default function ShadeMatchSection({
  tone,
  toneStatus,
  toneError,
  previewUrl,
  imageBlob,
  addedShadeId,
  onAddFoundation,
}: {
  tone: SkinToneResult | null;
  toneStatus: ToneStatus;
  toneError: string;
  previewUrl: string | null;
  imageBlob: Blob | null;
  addedShadeId: string | null;
  onAddFoundation: (match: ShadeMatch) => void;
}) {
  const matches = tone ? matchShades(tone) : [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    matches.find((m) => m.shade.id === selectedId) ?? matches[0] ?? null;

  const [tryOnPhase, setTryOnPhase] = useState<TryOnPhase>("idle");
  const [tryOnImageUrl, setTryOnImageUrl] = useState<string | null>(null);
  const [tryOnIsDemo, setTryOnIsDemo] = useState(false);
  const [tryOnError, setTryOnError] = useState("");
  const [tryOnShadeId, setTryOnShadeId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const pollTryOn = (taskId: string, attempts: number) => {
    pollRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/tryon/status?taskId=${encodeURIComponent(taskId)}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as {
          status?: string;
          demo?: boolean;
          imageUrl?: string | null;
          error?: string;
        };
        if (json.status === "success") {
          setTryOnImageUrl(json.imageUrl ?? null);
          setTryOnIsDemo(Boolean(json.demo));
          setTryOnPhase("done");
          return;
        }
        if (json.status === "error" || !res.ok) {
          setTryOnError(
            json.error ?? "The try-on could not be completed. Please try again."
          );
          setTryOnPhase("error");
          return;
        }
        if (attempts > 40) {
          setTryOnError("The try-on is taking too long. Please try again.");
          setTryOnPhase("error");
          return;
        }
        pollTryOn(taskId, attempts + 1);
      } catch {
        if (attempts > 40) {
          setTryOnError("We lost the connection during the try-on. Please try again.");
          setTryOnPhase("error");
          return;
        }
        pollTryOn(taskId, attempts + 1);
      }
    }, 2500);
  };

  const runTryOn = async (match: ShadeMatch) => {
    if (!imageBlob) return;
    if (pollRef.current) clearTimeout(pollRef.current);
    setSelectedId(match.shade.id);
    setTryOnShadeId(match.shade.id);
    setTryOnPhase("running");
    setTryOnError("");
    setTryOnImageUrl(null);
    try {
      const form = new FormData();
      form.append(
        "image",
        new File([imageBlob], "selfie.jpg", { type: "image/jpeg" })
      );
      form.append("shadeHex", match.shade.hex);
      form.append("shadeId", match.shade.id);
      const res = await fetch("/api/tryon", { method: "POST", body: form });
      const json = (await res.json()) as { taskId?: string; error?: string };
      if (!res.ok || !json.taskId) {
        setTryOnError(json.error ?? "Could not start the try-on. Please try again.");
        setTryOnPhase("error");
        return;
      }
      pollTryOn(json.taskId, 0);
    } catch {
      setTryOnError("We couldn't reach the try-on service. Please try again.");
      setTryOnPhase("error");
    }
  };

  const triedSelected =
    selected !== null &&
    tryOnPhase === "done" &&
    tryOnShadeId === selected.shade.id;

  return (
    <section className="mt-10">
      <h2 className="font-display text-3xl font-semibold text-forest">
        Your shade match
      </h2>
      <p className="mt-1 max-w-2xl text-ink/65">
        Your selfie also went through YouCam&apos;s Skin Tone Analysis.
        GlowCart measured your exact skin colour, matched it against the
        foundation shade range — then lets you <em>try the shade on your own
        face</em> before it ever reaches your cart.
      </p>

      {toneStatus === "running" && (
        <div className="mt-6 flex items-center gap-3 rounded-[2rem] border border-ink/10 bg-white p-6" role="status">
          <span className="animate-pulse-soft size-2.5 rounded-full bg-clay" />
          <p className="text-sm font-semibold text-ink">
            Reading your skin tone for shade matching…
          </p>
        </div>
      )}

      {toneStatus === "error" && (
        <div className="mt-6 rounded-[2rem] border border-clay/30 bg-clay/5 p-6">
          <p className="text-sm font-medium text-clay-dark" role="alert">
            Shade matching couldn&apos;t run this time ({toneError}). Your
            skin report and routine above and below are unaffected.
          </p>
        </div>
      )}

      {toneStatus === "done" && tone && (
        <div className="mt-6 rounded-[2rem] border border-ink/10 bg-white p-6">
          {/* Measured tone summary */}
          <div className="flex flex-wrap items-center gap-4">
            <span
              className="size-14 shrink-0 rounded-2xl border border-ink/15 shadow-inner"
              style={{ backgroundColor: tone.skinColor }}
              aria-hidden
            />
            <div>
              <p className="font-display text-xl font-semibold text-ink">
                {tone.depthLabel} depth · {tone.undertoneLabel} undertone
              </p>
              <p className="text-sm text-ink/55">
                Measured skin colour{" "}
                <code className="rounded bg-parchment px-1 font-mono text-[13px]">
                  {tone.skinColor}
                </code>
                {tone.eyeColorName && <> · eyes {tone.eyeColorName.toLowerCase()}</>}
                {tone.hairColorName && <> · hair {tone.hairColorName.toLowerCase()}</>}
                {" "}· matched in CIELAB colour space
              </p>
            </div>
            {tone.source === "demo" && (
              <span className="ml-auto rounded-full bg-gold/20 px-3 py-1.5 text-xs font-bold text-gold">
                Demo tone — sample data
              </span>
            )}
          </div>

          {/* Matched shades */}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {matches.map((match) => {
              const s = match.shade;
              const isSelected = selected?.shade.id === s.id;
              const isAdded = addedShadeId === s.id;
              return (
                <article
                  key={s.id}
                  className={`flex flex-col rounded-3xl border p-5 transition-all ${
                    isSelected
                      ? "border-clay bg-blush/15 shadow-[0_12px_28px_-14px_rgba(180,101,74,0.5)]"
                      : "border-ink/10 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="size-11 rounded-xl border border-ink/15"
                      style={{ backgroundColor: s.hex }}
                      aria-hidden
                    />
                    {match.rank === 1 && (
                      <span className="rounded-full bg-pine/10 px-2.5 py-1 text-[11px] font-bold text-pine">
                        Best match
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-ink">
                    {s.code} {s.name}
                  </h3>
                  <p className="text-xs font-medium text-ink/50">
                    Second Skin Liquid Foundation · {s.undertone} undertone ·{" "}
                    {s.depthLabel.toLowerCase()} depth
                  </p>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">
                    {match.reason}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-ink/8 pt-4">
                    <span className="font-display text-xl font-semibold text-ink">
                      {money(s.price)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void runTryOn(match)}
                      disabled={tryOnPhase === "running"}
                      className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-clay-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {tryOnPhase === "running" && tryOnShadeId === s.id
                        ? "Trying on…"
                        : isSelected && tryOnPhase === "done"
                          ? "Try on again"
                          : "Try this shade on"}
                    </button>
                  </div>
                  {isAdded && (
                    <p className="mt-2 text-xs font-semibold text-pine">
                      ✓ This exact shade is in your routine below
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          {/* Try-on result */}
          {selected && previewUrl && (
            <div className="mt-6">
              {tryOnPhase === "running" && (
                <div className="flex items-center gap-3 rounded-3xl bg-parchment p-5" role="status">
                  <span className="animate-pulse-soft size-2.5 rounded-full bg-clay" />
                  <p className="text-sm font-semibold text-ink">
                    Applying {selected.shade.code} {selected.shade.name} to
                    your photo with YouCam Makeup VTO…
                  </p>
                </div>
              )}
              {tryOnPhase === "error" && (
                <p className="rounded-3xl bg-clay/10 px-5 py-4 text-sm font-medium text-clay-dark" role="alert">
                  {tryOnError}
                </p>
              )}
              {triedSelected && (
                <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
                  <TryOnCompare
                    beforeUrl={previewUrl}
                    afterUrl={tryOnImageUrl}
                    shadeHex={selected.shade.hex}
                    shadeLabel={`${selected.shade.code} ${selected.shade.name}`}
                    isDemoRender={tryOnIsDemo}
                  />
                  <div className="flex flex-col rounded-3xl bg-forest p-5 text-cream">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blush">
                      You&apos;re wearing
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold leading-tight">
                      {selected.shade.code} {selected.shade.name}
                    </p>
                    <p className="mt-1 text-sm text-cream/75">
                      Second Skin Liquid Foundation · {selected.shade.undertone}{" "}
                      undertone · satin finish
                    </p>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-cream/85">
                      Matched to your measured skin colour {tone.skinColor}.
                      Drag the slider to compare.
                    </p>
                    <button
                      type="button"
                      onClick={() => onAddFoundation(selected)}
                      disabled={addedShadeId === selected.shade.id}
                      className="mt-4 w-full rounded-full bg-clay py-3 text-sm font-bold text-white transition-colors hover:bg-clay-dark disabled:cursor-not-allowed disabled:bg-pine"
                    >
                      {addedShadeId === selected.shade.id
                        ? "In your routine ✓"
                        : `Add this exact foundation — ${money(selected.shade.price)}`}
                    </button>
                  </div>
                </div>
              )}
              {tryOnPhase === "idle" && (
                <p className="rounded-3xl bg-parchment px-5 py-4 text-sm text-ink/65">
                  Pick <strong>“Try this shade on”</strong> above —
                  YouCam applies that exact shade to your photo.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
