# Fast-pitch upgrade guide

Goal: walk into a dental-clinic pitch and show a **tailored, working clinic site in ~3 minutes**, then hand over a link or a hosted ZIP.

The app already does most of this. Read this before changing anything so you do not rebuild what exists.

## What already works (do not rebuild)

- **One-click create**: Prospect view → *From Google Maps* → fill facts → **Add and build** creates the prospect + project and opens the editor. `components/QuickAddDialog.tsx:38`, `components/Studio.tsx:25`, `app/api/studio/route.ts:84,110`.
- **Instant editor preview**: every keystroke re-renders the full site in-memory via `renderClinicSite` and swaps the iframe `srcDoc`. No save needed to preview. `components/Editor.tsx:30-32`.
- **One renderer, three outputs**: editor preview, published release and export ZIP all call `renderClinicSite` (`lib/site/renderer.mjs:92`). Never fork the HTML.
- **Publish a shareable link**: `/preview/{slug}/`, noindex, served from stored release files. `lib/server/projects.ts:39`.
- **Local demo, no login**: `STUDIO_LOCAL_DEMO=1` seeds a fully populated OLI example and skips auth in dev only. `lib/server/auth.ts:4`, `lib/seed.ts`.

The single real gap: **a brand-new project looks empty.** `createClinicConfig` (`lib/site/renderer.mjs:19`) returns no services, no FAQs, one generic hero line and a default teal theme. That is what makes a fresh pitch look like a template.

## Upgrades, in payoff order

### 1. Preset library (highest payoff, no dependencies) — DO THIS FIRST

Give every new project a plausible theme, 4–6 services and 2–3 FAQs before the owner types anything. Static data, no AI, no network.

- Add a `PRESETS` map in `lib/site/renderer.mjs` (e.g. `general`, `ortho`, `cosmetic`), each with `theme`, `services` (`[title, summary]` pairs) and `faqs`. Reuse the `[title, summary] → SiteService` mapping already in `lib/seed.ts:16`.
- In `createClinicConfig`, accept `input.preset` and prefill theme/services/faqs when present.
- Pass a preset from `createProject` (`app/api/studio/route.ts:110`) and add a `<select>` of presets to `QuickAddDialog` (extend `QuickAddData` and the `onBuild`/`onConfirm` payloads through `Studio.tsx:24-25`).

Why it exists: it converts "empty template" into "looks like their clinic" with zero network calls and zero new deps.
```js
// shortcut: three hardcoded presets; move to per-clinic generation only when
// owners actually ask for bespoke copy during a pitch.
```

### 2. Quick add with only a clinic name (smallest diff)

Today `mapsUrl` is required (`app/api/studio/route.ts:92`) and the Add buttons stay disabled without it (`components/QuickAddDialog.tsx:38`). For a cold pitch you often have just a name.

- Make `mapsUrl` optional: keep `safeHttps` validation only when a value is supplied; dedupe still works by normalized name/address (`normalizedLeadKey`, `route.ts:97-99`).
- Drop `|| !facts.mapsUrl.trim()` from the disabled checks.
- The renderer already degrades without a map (`lib/site/renderer.mjs:121` map placeholder).

### 3. One-click "Save & publish" (minor, removes a click)

Publish is blocked while the draft is dirty (`components/Editor.tsx:47`). Chain it: make the publish handler `await save()` then publish so a pitch never shows "save first".

### 4. Import a logo/cover from a URL (visuals fast)

`saveImage` (`lib/server/projects.ts:11`) already validates signature, re-encodes to WebP at 1600px and stores it. Add a tiny server action that `fetch()`es an HTTPS image and passes the bytes to `saveImage`. Use the clinic's existing logo or social image instead of asking them to upload during a pitch.
```js
// shortcut: HTTPS URL only, single image, relies on saveImage's 5 MB / 20 MP caps.
```

### 5. Share it (no code)

- **On your laptop**: the local-demo preview is enough to show live.
- **As a link**: with `.env.local` Supabase configured (see `README.md` → Supabase setup), `npm run dev` → sign in → publish → send `/preview/{slug}/`.
- **As a static site**: *Export ZIP* (draft) → unzip → drag `site/` onto Netlify Drop. `site/` needs no Next.js, Supabase or studio (`lib/export.ts:25`).

## Do not build (YAGNI for v1)

- **AI copy generation**: API keys, cost, latency, and it will invent unverified medical claims — the opposite of what this app is careful about. Presets (upgrade 1) get 80% of the look for 5% of the work.
- **Google Maps scraping/OCR**: ToS risk; manual quick-add is fine for pitches.
- **Booking backend, billing, multi-tenant auth**: explicitly out of scope (`README.md:132`).
- **A second renderer or a Tailwind rewrite**: one renderer keeps preview, publish and ZIP honest.
- **Auto-sampling a palette from the logo**: `sharp` could do it, but a preset palette row is simpler and predictable.

## Pitch-day runbook

```powershell
# once
npm ci; npm run fonts

# local demo (seeded OLI, no login) — best for live demo
$env:STUDIO_LOCAL_DEMO='1'; npm run dev   # http://127.0.0.1:3000

# or against the real Supabase owner account
npm run dev                                # then sign in at /login
```
1. Prospects → *From Google Maps* → paste the listing, pick a preset → **Add and build**.
2. Editor tabs (Brand → Design → Content → Care → Contact) while the live preview updates.
3. **Publish preview** → copy `/preview/{slug}/` (noindex) → send or screen-share.
4. Handoff: **Export ZIP** (draft) → `site/` → Netlify Drop.

To reset demo data between pitches, delete `.local-studio/` (local mode only).

## Verify before any pitch or commit

```powershell
npm run typecheck
npm test
npm run build
node scripts/check-production-auth.mjs
npx playwright install chromium; npm run test:browser   # port 3013, fresh data
```

## Repo gotchas that waste time

- **This is Next.js 16 with breaking changes.** Read `node_modules/next/dist/docs/` before touching framework code. `proxy.ts` is the middleware equivalent (see `proxy.ts`); the browser test webServer runs `next dev --webpack`.
- **Build runs `prepare-fonts` first** (`package.json:9`); `npm run fonts` copies woff2 from `@fontsource` before dev once.
- **Env/config**: four Supabase vars + `STUDIO_OWNER_ID`; `STUDIO_LOCAL_DEMO` is dev-only and ignored in production (`lib/server/auth.ts:4`, `README.md` Supabase setup).
- **Uploads reject SVG** and are re-encoded to WebP (`lib/server/projects.ts:16`).
- **Slug locks after first publish** (`app/api/studio/route.ts:125`).
- **Production export requires** a final HTTPS domain and a confirmed contact method (`productionIssues`, `lib/site/renderer.mjs:84`).
