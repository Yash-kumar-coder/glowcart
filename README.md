# GlowCart — Scan. Match. Try it on. Then buy.

GlowCart is a scan-to-shopping web app built for the **YouCam API Skin AI
& eCommerce VTO Hackathon** (Devpost · Perfect Corp). It runs **three**
YouCam APIs on a single selfie and closes the loop from diagnosis to
purchase:

**Scan** (AI Skin Analysis) → **Match** (AI Skin Tone Analysis + shade
matching) → **Try it on** (AI Makeup VTO, on your own face) → **Buy** (a
routine + your proven foundation shade, trimmed to your budget) — with a
deterministic **GlowAdvisor** layer explaining every decision from your
actual numbers.

![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![YouCam API](https://img.shields.io/badge/YouCam%20API-Skin%20Analysis%20·%20Skin%20Tone%20·%20Makeup%20VTO-ff6b9d)

## The problem

People buy skincare blind. Most routines are assembled from a friend's post,
a pretty jar, or a sale — not from any measurement of the buyer's own skin.
The result: bathroom shelves full of products the skin never asked for,
strong actives layered on skin that can't tolerate them (quietly wrecking
the moisture barrier), and money spent twice — first on the wrong routine,
then on fixing it.

GlowCart flips the order: **measure first, match second, prove it on your
own face — then buy only what the measurement points to.**

## What it does

1. **Scan** — Upload a selfie or capture one with your camera (the image is
   downscaled/compressed in the browser before upload). Friendly photo tips
   follow Perfect Corp's own guidance for accurate analysis.
2. **Scores** — An animated skin report: overall skin score gauge,
   estimated skin age, and per-concern score bars for 12 concerns
   (moisture, wrinkles, acne, pores, oiliness, redness, dark circles, eye
   bags, firmness, radiance, texture, age spots), sorted weakest-first with
   plain-language explanations and "what helps" advice.
3. **GlowAdvisor** — A deterministic reasoning panel (no LLM, no extra
   keys) that reads *your* numbers and writes: a personal summary ("The
   headline issue is moisture at 58/100…"), a score-tied reason for every
   recommended product, the budget trade-offs (what was held back and
   why, live-updated with the budget filter), and an AM/PM usage plan
   with per-step instructions.
4. **Match** — The same selfie goes through YouCam's **Skin Tone
   Analysis**. GlowCart derives your depth (ITA°, the dermatology
   standard) and undertone (CIELAB a*/b* balance) from the measured skin
   colour, then ranks a 12-shade foundation catalogue in CIELAB space
   (ΔE + undertone agreement) and shows your top 3 shades, each with a
   plain-language reason ("Matched to your warm undertone and medium
   depth").
5. **Try it on** — Pick a matched shade and YouCam's **Makeup VTO**
   applies that exact foundation colour to *your photo*. A draggable
   before/after slider proves the shade on your own face — then one click
   adds that exact foundation to your routine and cart.
6. **Shop your routine** — A routine builder that picks one hero product
   for each of your 3 weakest concerns plus matched essentials (cleanser,
   moisturizer, SPF) from a 15-product catalog (plus your tried-on
   foundation when you add it); a budget filter (Under $50 / $100 / $200 /
   No limit) walks picks in priority order and holds back what doesn't
   fit; a working cart with totals, an over-budget warning,
   free-shipping threshold, AM/PM routine timelines, and a demo checkout.

## YouCam API integration

All Perfect Corp calls happen **server-side only** in
[`lib/youcam.ts`](lib/youcam.ts); the API key (`YOUCAM_API_KEY`) is sent as
a `Bearer` token and never reaches the browser. All three features use
the documented **V2 flow** against `https://yce-api-01.makeupar.com`
(docs: https://yce.perfectcorp.com/document/index.html):

| Step | Call | Purpose |
| --- | --- | --- |
| 1 | `POST /s2s/v2.0/file/<feature>` | Initialize upload with `{ files: [{ content_type, file_name, file_size }] }`; returns a `file_id` and a pre-signed upload request |
| 2 | `PUT <pre-signed S3 URL>` | Upload the raw image bytes with the headers the File API returned (this step is mandatory — skipping it makes task calls fail) |
| 3 | `POST /s2s/v2.0/task/<feature>` | Create the task (feature-specific body below); returns a `task_id` |
| 4 | `GET /s2s/v2.0/task/<feature>/<task_id>` | Poll until `data.task_status` is `success` or `error` |

### The three features

**1. AI Skin Analysis** (`skin-analysis`)
Task body: `{ src_file_id, dst_actions: [12 SD concerns], miniserver_args: { enable_mask_overlay: true }, format: "json" }`.
Result: per-concern scores + overall + skin age. The normalizer
([`lib/normalize.ts`](lib/normalize.ts)) accepts **both documented result
shapes** — the V2 `results.output[]` array (`{ type, ui_score, raw_score,
mask_urls }`) and the `score_info.json` object (per-concern `{ raw_score,
ui_score, output_mask_name }`, `all.score`, `skin_age`) — including HD
variants with `hd_` prefixes and nested sub-region scores.

**2. AI Skin Tone Analysis** (`skin-tone-analysis`)
Task body: `{ src_file_id, face_angle_strictness_level: "high" }`.
Documented result:
```json
{ "data": { "task_status": "success", "results": {
  "face_quality": { "has_face": true, "area": "good", "frontal": "good",
                    "lighting": "good", "faceangle": "good" },
  "color": { "skin_color": "#b9947c", "eye_color": "#62432e",
             "eye_color_name": "Amber", "lip_color": "#b26a5e",
             "eyebrow_color": "#3a2a20", "hair_color": "#a05a3c",
             "hair_color_name": "Auburn" } } } }
```
The API returns the measured skin **colour** (hex); GlowCart's normalizer
tolerates this shape and the guide's minimal `{ "skin_color": "#b28e73" }`
form, then derives **depth** via ITA° (the dermatology-standard
classification from CIELAB L*/b*) and **undertone** from the CIELAB
a*/b* balance — warm if yellow dominates, cool if red does, neutral when
balanced. Shade matching ([`lib/shades.ts`](lib/shades.ts)) then ranks 12
foundation shades by CIELAB ΔE to your measured colour, with a penalty
when a shade's undertone fights yours.

**3. AI Makeup VTO** (`makeup-vto`)
Task body: `{ src_file_id, version: "1.0", effects: [...] }` with the
documented foundation effect for the chosen shade:
```json
{ "category": "foundation",
  "palettes": [{ "color": "#bd9673", "colorIntensity": 55,
                 "glowIntensity": 35, "coverageIntensity": 60 }] }
```
(plus a light `skin_smooth` effect). The success payload carries the
processed image (`data.results.url`; the schema also documents
`[{ "download_url" }]` — the extractor tolerates both), rendered in a
before/after slider against the original selfie.

The browser talks only to GlowCart's own routes, which gives the UI a
clean polling contract per feature:

- `POST /api/analyze` · `GET /api/analyze/status?taskId=…` — skin analysis
- `POST /api/tone` · `GET /api/tone/status?taskId=…` — skin tone → `SkinToneResult`
- `POST /api/tryon` (multipart `image` + `shadeHex`) · `GET /api/tryon/status?taskId=…` → `{ status: "success", demo, imageUrl }`

Documented YouCam error codes (`error_no_face`,
`error_lighting_dark`, `error_face_position_invalid`, …) are mapped to
friendly, actionable messages. Skin analysis and tone analysis run **in
parallel** on the same selfie; if the tone read fails, the report and
routine still work — only shade matching is skipped.

### GlowAdvisor

[`lib/advisor.ts`](lib/advisor.ts) is a pure, deterministic module (no
LLM calls, no keys): given the normalized skin + tone results, the
routine picks and the current budget, it generates the summary, the
per-product score-tied reasons, the budget trade-off notes (it re-runs
the same `applyBudget` walk the UI uses) and the AM/PM plan. Every number
it quotes is the user's own measured number.

### Demo mode

No API key? No problem. When `YOUCAM_API_KEY` is empty, the app runs in
**demo mode**: each route issues a demo task that stays "running" for a
few seconds (so the polling UI behaves identically), then resolves with a
realistic sample payload in the exact documented shape
([`lib/demo.ts`](lib/demo.ts)) that flows through the **same
normalizers**. Demo tone uses the docs' own example skin colour
(`#b9947c` → medium depth, warm undertone), so shade matching runs for
real on it. A demo **try-on** resolves with no image URL, and the client
renders a clearly labeled approximation instead: your own photo with a
soft-light/multiply tint in the exact shade colour plus a gentle
softening filter. Demo results are labeled **"Demo result"** throughout
the UI. Add a real key and the same flow hits the live YouCam APIs — no
code changes.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript** throughout
- **Tailwind CSS v4** with a custom warm skincare palette (cream / blush /
  clay / deep green) and Fraunces + Inter typography via `next/font`
- **YouCam APIs** (Perfect Corp) — AI Skin Analysis, AI Skin Tone
  Analysis and AI Makeup VTO, all via the V2 server-to-server flow
- **Colour science in TypeScript** — sRGB → CIELAB conversion, ITA° depth
  classification, ΔE shade ranking (no external services)

## Getting started

```bash
# 1. Install
npm install

# 2. (Optional) add your YouCam API key — skip this to run in demo mode
cp .env.example .env.local
# then edit .env.local: YOUCAM_API_KEY=<your key from https://yce.makeupar.com/api-console/en/api-keys/>

# 3. Run
npm run dev        # http://localhost:3000

# Production check
npm run build && npm run start
```

## Project structure

```
app/
  page.tsx                 Landing page (hero, problem, how-it-works, concerns)
  scan/page.tsx            Scan flow: capture → report → advisor → shade
                           match + try-on → routine + cart
  api/analyze/route.ts     POST: upload photo, start skin-analysis task
  api/analyze/status/route.ts  GET: poll task, return normalized result
  api/tone/route.ts        POST: start skin-tone-analysis task
  api/tone/status/route.ts GET: poll task, return normalized tone result
  api/tryon/route.ts       POST: start makeup-vto task for a shade
  api/tryon/status/route.ts GET: poll task, return try-on image URL
  layout.tsx               Fonts, header, footer
  globals.css              Tailwind v4 theme (palette, animations)
components/
  ScoreGauge.tsx           Animated overall-score gauge
  ConcernBars.tsx          Weakest-first per-concern score bars
  AdvisorPanel.tsx         GlowAdvisor panel (summary, reasons, plan)
  ShadeMatch.tsx           Tone summary, matched shades, VTO before/after
  RoutineBuilder.tsx       Budget filter, product picks, cart
lib/
  youcam.ts                Server-side YouCam V2 client for all 3 features
  normalize.ts             Skin + tone normalizers, CIELAB colour science
  shades.ts                12-shade foundation catalogue + ΔE matching
  advisor.ts               GlowAdvisor deterministic reasoning module
  demo.ts                  Demo-mode sample payloads + fake task store
  catalog.ts               15-product demo catalog with concern tags
  recommend.ts             Routine builder + budget engine
```

## Screenshots

_Screenshots of the live app (demo mode) are attached in the Devpost submission gallery._

## Notes & limitations

- The product catalog and checkout are illustrative demo data (USD prices);
  swap `lib/catalog.ts` for a real commerce feed to productionize.
- Skin scores are cosmetic guidance, not a medical diagnosis.
- Photos are processed by Perfect Corp's YouCam API and retained there per
  [their policy](https://yce.perfectcorp.com/document/index.html)
  (uploaded files are deleted after 24 hours); GlowCart itself stores
  nothing.

## License

MIT — see [LICENSE](LICENSE) if present, or treat this repository as
MIT-licensed for hackathon judging purposes.
