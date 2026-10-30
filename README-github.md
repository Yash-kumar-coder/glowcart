# GlowCart — Scan your skin. Shop only what it actually needs.

GlowCart is a skin-scan-to-shopping web app built for the **YouCam API Skin AI
& eCommerce VTO Hackathon** (Devpost · Perfect Corp).

Take one selfie → YouCam's AI Skin Analysis scores your skin → GlowCart turns
those scores into a personalized, shoppable skincare routine: products matched
to your *weakest* concerns, organized into AM/PM steps, and trimmed to a
budget you choose.

![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![YouCam API](https://img.shields.io/badge/YouCam%20API-Skin%20Analysis-ff6b9d)

## The problem

People buy skincare blind. Most routines are assembled from a friend's post,
a pretty jar, or a sale — not from any measurement of the buyer's own skin.
The result: bathroom shelves full of products the skin never asked for,
strong actives layered on skin that can't tolerate them (quietly wrecking
the moisture barrier), and money spent twice — first on the wrong routine,
then on fixing it.

GlowCart flips the order: **measure first, then buy only what the
measurement points to.**

## What it does

1. **Scan** — Upload a selfie or capture one with your camera (the image is
   downscaled/compressed in the browser before upload). Friendly photo tips
   follow Perfect Corp's own guidance for accurate analysis.
2. **Scores** — An animated skin report: overall skin score gauge,
   estimated skin age, and per-concern score bars for 12 concerns
   (moisture, wrinkles, acne, pores, oiliness, redness, dark circles, eye
   bags, firmness, radiance, texture, age spots), sorted weakest-first with
   plain-language explanations and "what helps" advice.
3. **Shop your routine** — A routine builder that picks one hero product
   for each of your 3 weakest concerns plus matched essentials (cleanser,
   moisturizer, SPF) from a 15-product catalog; a budget filter
   (Under $50 / $100 / $200 / No limit) walks picks in priority order and
   holds back what doesn't fit; a working cart with totals, an
   over-budget warning, free-shipping threshold, AM/PM routine timelines,
   and a demo checkout.

## YouCam API integration

All Perfect Corp calls happen **server-side only** in
[`lib/youcam.ts`](lib/youcam.ts); the API key (`YOUCAM_API_KEY`) is sent as
a `Bearer` token and never reaches the browser. The integration implements
the documented **V2 flow** against `https://yce-api-01.makeupar.com`:

| Step | Call | Purpose |
| --- | --- | --- |
| 1 | `POST /s2s/v2.0/file/skin-analysis` | Initialize upload with `{ files: [{ content_type, file_name, file_size }] }`; returns a `file_id` and a pre-signed upload request |
| 2 | `PUT <pre-signed S3 URL>` | Upload the raw image bytes with the headers the File API returned (this step is mandatory — skipping it makes task calls fail) |
| 3 | `POST /s2s/v2.0/task/skin-analysis` | Create the task with `{ src_file_id, dst_actions: [12 SD concerns], miniserver_args: { enable_mask_overlay: true }, format: "json" }`; returns a `task_id` |
| 4 | `GET /s2s/v2.0/task/skin-analysis/<task_id>` | Poll until `data.task_status` is `success` or `error` |

The browser talks only to GlowCart's own routes, which gives the UI a clean
polling contract:

- `POST /api/analyze` (multipart `image`) → `{ taskId, demo }`
- `GET /api/analyze/status?taskId=…` → `{ status: "running" }` ·
  `{ status: "success", result }` · `{ status: "error", error }`

Responses are normalized by [`lib/normalize.ts`](lib/normalize.ts), which
accepts **both documented result shapes** — the V2 `results.output[]` array
(`{ type, ui_score, raw_score, mask_urls }`) and the `score_info.json`
object (per-concern `{ raw_score, ui_score, output_mask_name }`, `all.score`,
`skin_age`) — including HD variants with `hd_` prefixes and nested
sub-region scores. Documented YouCam error codes (`error_no_face`,
`error_lighting_dark`, `error_src_face_too_small`, …) are mapped to
friendly, actionable messages.

### Demo mode

No API key? No problem. When `YOUCAM_API_KEY` is empty, the app runs in
**demo mode**: `/api/analyze` issues a demo task that stays "running" for a
few seconds (so the polling UI behaves identically), then resolves with a
realistic sample payload in the exact documented `score_info` shape
([`lib/demo.ts`](lib/demo.ts)) that flows through the same normalizer.
Results are clearly labeled **"Demo result"** in the UI. Add a real key and
the same flow hits the live YouCam API — no code changes.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript** throughout
- **Tailwind CSS v4** with a custom warm skincare palette (cream / blush /
  clay / deep green) and Fraunces + Inter typography via `next/font`
- **YouCam AI Skin Analysis API** (Perfect Corp) — V2 server-to-server flow

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
  scan/page.tsx            Scan flow: capture → analyzing → report + routine
  api/analyze/route.ts     POST: upload photo, start analysis task
  api/analyze/status/route.ts  GET: poll task, return normalized result
  layout.tsx               Fonts, header, footer
  globals.css              Tailwind v4 theme (palette, animations)
components/
  ScoreGauge.tsx           Animated overall-score gauge
  ConcernBars.tsx          Weakest-first per-concern score bars
  RoutineBuilder.tsx       Budget filter, product picks, cart
lib/
  youcam.ts                Server-side YouCam V2 client (upload → task → poll)
  normalize.ts             Response normalizer for both documented shapes
  demo.ts                  Demo-mode sample payload + fake task store
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
