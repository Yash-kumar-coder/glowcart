import Link from "next/link";
import { CONCERN_META } from "@/lib/normalize";

/** Static mini-bars for the hero's sample report card. */
function SampleReportCard() {
  const rows = [
    { label: "Moisture", score: 58, color: "#B4654A" },
    { label: "Dark circles", score: 61, color: "#C4822E" },
    { label: "Pores", score: 63, color: "#C4822E" },
    { label: "Firmness", score: 83, color: "#2F5D46" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md rotate-1 rounded-[2rem] border border-ink/10 bg-white p-6 shadow-[0_32px_64px_-24px_rgba(31,61,43,0.35)] transition-transform duration-500 hover:rotate-0">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/45">
          Sample skin report
        </p>
        <span className="rounded-full bg-blush/60 px-2.5 py-1 text-[11px] font-bold text-clay-dark">
          Skin age 31
        </span>
      </div>
      <div className="mt-4 flex items-end gap-3">
        <span className="font-display text-7xl font-semibold leading-none text-forest">
          71
        </span>
        <div className="pb-1.5">
          <p className="text-sm font-semibold text-ink">Overall skin score</p>
          <p className="text-xs text-ink/55">Healthy, with room to glow</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex justify-between text-xs font-semibold text-ink/70">
              <span>{r.label}</span>
              <span className="tabular-nums">{r.score}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full"
                style={{ width: `${r.score}%`, backgroundColor: r.color }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl bg-parchment p-3.5">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/50">
          Matched for this skin
        </p>
        <p className="mt-1 text-sm font-semibold text-ink">
          Hydra-Drench Serum · Caffeine Eye Concentrate · SPF 50
        </p>
        <p className="mt-1 text-xs text-ink/55">
          Routine total $83 — inside a $100 budget
        </p>
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Scan",
    body: "Take or upload one front-facing selfie. YouCam's AI reads your skin in seconds — no questionnaires, no guesswork about your \"skin type\".",
  },
  {
    n: "02",
    title: "Scores",
    body: "Get an overall skin score, an estimated skin age, and a score for each of 12 concerns — moisture, wrinkles, pores, acne and more — weakest first, in plain language.",
  },
  {
    n: "03",
    title: "Shop your routine",
    body: "We build your AM and PM routine from your three weakest concerns, add the essentials, and keep it inside the budget you choose. Nothing more, nothing less.",
  },
];

const PROBLEMS = [
  {
    title: "Bought blind",
    body: "Most skincare is picked from a friend's post, a pretty jar or a sale — not from any measurement of your own skin. So the shelf fills with products your skin never asked for.",
  },
  {
    title: "Wrong actives, real damage",
    body: "Layering strong acids and retinoids your skin doesn't need (or can't tolerate) quietly wrecks the moisture barrier — the very thing that keeps skin calm and clear.",
  },
  {
    title: "Money spent twice",
    body: "When a blind-bought routine fails, the fix is usually another blind purchase. GlowCart flips it: measure first, then buy only what the measurement points to.",
  },
];

export default function Home() {
  return (
    <div>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-blush/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 top-64 size-80 rounded-full bg-moss/20 blur-3xl"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-2 lg:pt-20">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-forest/15 bg-white/70 px-3.5 py-1.5 text-xs font-bold text-forest">
              <span className="size-1.5 rounded-full bg-clay" />
              Powered by YouCam AI Skin Analysis
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-forest sm:text-6xl">
              Scan your skin.
              <br />
              Shop only what it{" "}
              <em className="italic text-clay">actually</em> needs.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/70">
              One selfie is enough. GlowCart scores 12 skin concerns with
              Perfect Corp&apos;s YouCam AI, then builds a shoppable routine
              around your weakest ones — inside a budget you set.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/scan"
                className="rounded-full bg-clay px-7 py-3.5 text-base font-bold text-white shadow-[0_12px_24px_-10px_rgba(180,101,74,0.7)] transition-all hover:-translate-y-0.5 hover:bg-clay-dark"
              >
                Start your free scan →
              </Link>
              <Link
                href="#how-it-works"
                className="rounded-full border border-forest/20 bg-white/60 px-6 py-3.5 text-base font-semibold text-forest transition-colors hover:border-forest/50"
              >
                How it works
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink/60">
              <li>✓ 12 concerns measured</li>
              <li>✓ Results in under a minute</li>
              <li>✓ No account, no card</li>
            </ul>
          </div>
          <div className="animate-fade-up-late">
            <SampleReportCard />
          </div>
        </div>
      </section>

      {/* ---------------------------- Problem ----------------------------- */}
      <section className="bg-forest text-cream">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blush">
            The problem
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-4xl">
            People buy skincare blind — and their skin pays for it.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PROBLEMS.map((p) => (
              <article
                key={p.title}
                className="rounded-3xl border border-cream/12 bg-cream/5 p-6"
              >
                <h3 className="font-display text-xl font-semibold text-cream">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cream/75">
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- How it works -------------------------- */}
      <section id="how-it-works" className="scroll-mt-24">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay">
                How it works
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-forest sm:text-4xl">
                Selfie in. Routine out.
              </h2>
            </div>
            <Link
              href="/scan"
              className="rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-cream transition-colors hover:bg-clay"
            >
              Try the scan
            </Link>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <article
                key={s.n}
                className="rounded-3xl border border-ink/10 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_36px_-20px_rgba(31,61,43,0.35)]"
              >
                <span className="font-display text-4xl font-semibold text-blush">
                  {s.n}
                </span>
                <h3 className="mt-3 font-display text-2xl font-semibold text-ink">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  {s.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- Concerns ----------------------------- */}
      <section id="concerns" className="scroll-mt-24 bg-parchment/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay">
            What we measure
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold text-forest sm:text-4xl">
            Twelve concerns, one honest picture of your skin.
          </h2>
          <p className="mt-3 max-w-2xl text-ink/65">
            Every scan scores each concern from 0–100 using the YouCam AI Skin
            Analysis engine. Your routine is built from whichever three score
            lowest — because that&apos;s where your money does the most good.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {Object.values(CONCERN_META).map((c) => (
              <span
                key={c.label}
                className="rounded-full border border-forest/15 bg-cream px-4 py-2 text-sm font-semibold text-forest"
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- CTA ------------------------------- */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-blush/50 px-6 py-12 text-center sm:px-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-cream/50 blur-2xl"
            />
            <h2 className="relative mx-auto max-w-xl font-display text-3xl font-semibold leading-tight text-forest sm:text-4xl">
              Your skin already knows what it needs. Ask it.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-ink/65">
              A scan takes less than a minute, and your next routine will be
              the first one chosen by your skin — not by an ad.
            </p>
            <Link
              href="/scan"
              className="relative mt-7 inline-block rounded-full bg-forest px-8 py-3.5 text-base font-bold text-cream transition-all hover:-translate-y-0.5 hover:bg-clay"
            >
              Scan my skin →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
