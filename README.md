# Dental Clinic Preview and Export Studio

A private, single-owner Next.js/TypeScript workspace for researching dental prospects, tailoring clinic websites, publishing pitch previews and downloading portable websites. Supabase stores the owner session, workspace and private assets. Final client hosting is a separate manual workflow.

## Run locally

Use Node.js 24 LTS and npm. From this directory:

```powershell
npm ci
npm run fonts
Copy-Item .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. With no Supabase settings, the app displays setup instructions and rejects private API access.

For an immediate local walkthrough without credentials:

```powershell
$env:STUDIO_LOCAL_DEMO='1'
npm run dev
```

Local mode saves to `.local-studio/`, is bound to loopback by the npm command, and bypasses authentication **only when NODE_ENV is development**. Never expose the development server publicly. The production server ignores this flag. Do not import real prospect data into a development server exposed through a tunnel. Optional `STUDIO_LOCAL_DATA_DIR` chooses a separate directory inside this workspace; browser tests use it for isolation when they launch their own server.

The first workspace contains OLI, linked to its Maps place ID and the **Proposal requested** stage. Import either supplied workbook using **Import spreadsheet**, review changes, then confirm. They produce 49 contactable prospects, including 13 high priority; importing both preserves 49. Workbooks remain unchanged. New clinic projects prefill only supplied name/address/phone/review snapshot and use neutral copy with no OLI services, quotes or photos. A phone does not enable WhatsApp until explicitly confirmed.

## Supabase setup

1. Create a Supabase project.
2. Run [`supabase/migrations/001_studio.sql`](supabase/migrations/001_studio.sql) in the project's SQL editor. Projects that applied the earlier version with a public owner-check function must also run [`002_private_owner_helper.sql`](supabase/migrations/002_private_owner_helper.sql); it is safe after the updated first migration too.
3. In Authentication settings, **disable new user signups**. Create the one owner user in the admin dashboard (email/password); confirm that account's email. Use a strong password. There is no signup or invitation interface in this app.
4. Copy that user's UUID. Run the following SQL, replacing the placeholder:

```sql
insert into public.studio_owner(singleton, owner_id)
values (true, 'YOUR_OWNER_USER_UUID')
on conflict(singleton) do update set owner_id=excluded.owner_id;
```

5. Set these in `.env.local` and later in Vercel:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (legacy anon key also works) |
| `SUPABASE_SECRET_KEY` | Server secret key (legacy service-role key also works) |
| `STUDIO_OWNER_ID` | Exactly the UUID inserted above |

Keep the secret key server-side. Never prefix it with `NEXT_PUBLIC_` or put it in clinic content. Restart after changing environment settings. The app creates the owner's initial workspace on first authenticated access.

The migration enables RLS on owner/workspace tables and creates a **private** `studio` Storage bucket. Direct authenticated access requires both the configured owner row and matching user UUID; anonymous users have no workspace or asset access. The server verifies the owner for every private action. Public preview requests read only manifests and files for explicitly published releases. `studio_owner` has no direct client grants. Supabase's secret key bypasses RLS, so it must remain private.

The owner-check function lives in the unexposed `studio_private` schema, with execution restricted to authenticated callers and an internal `auth.uid()` check. Keep this schema out of the Data API's exposed schemas. Supabase may report an informational "RLS Enabled No Policy" notice for `studio_owner`: this is intentional, because direct client access to the owner registry is denied.

The bucket permits generated SVG favicon files; **image uploads still reject SVG**, verify raster signatures, decode, remove metadata and re-encode WebP. Temporary uploads use authorized signed upload URLs so a 5 MB image need not pass through Vercel's request limit. They are validated server-side after upload. Uploads left incomplete can be removed later from the owner's `uploads/` prefix.

## Deploy to Vercel

1. Put the project in a private Git repository; exclude `.env*`, `.local-studio/`, `.cache/`, `.next/` and `node_modules/`. `.gitignore` is included. The original standalone OLI files remain in place but the Next.js app handles the studio routes.
2. Import that repository into Vercel. Choose **Next.js**, Node.js **24.x**, install command `npm ci`, build command `npm run build`.
3. Configure the four Supabase variables for the appropriate deployment environments. Leave `STUDIO_LOCAL_DEMO` unset or `0`.
4. Deploy. Add the final studio URL in Supabase Auth URL settings. Email/password sign-in uses cookies; there is no OAuth callback flow.
5. Sign in as owner. Import a workbook, tailor a clinic, save and explicitly publish.
6. Open the pitch URL in a private browser window. Verify it renders, remains `noindex`, and that `/api/studio`, `/api/assets/{id}`, upload/import/export actions and drafts are inaccessible without the owner session.

Publishing uses the studio domain's stable **path** `/preview/clinic-slug/`; wildcard DNS or per-clinic subdomains are not required by this version. The clinic slug locks after first publication. Your final clinic domain is used only in production ZIP output; final hosting and DNS remain manual.

Vercel function responses never contain a ZIP. The browser downloads authorized image URLs and public local fonts, then assembles the archive. Preview publication writes small files to Supabase first, then switches the saved release pointer with optimistic concurrency. If storage or the pointer update fails, the existing preview stays intact. Very large prospect collections are outside this small, single-owner JSON-workspace design; supported imports are capped at 2 MB compressed / 30 MB expanded / 2,000 rows.

## Daily workflow

- **Prospects:** import `.xlsx`, inspect detected columns and changes, acknowledge skipped invalid/ambiguous rows, search/filter, shortlist and track outreach. Research dates, evidence, source rows, cached formula results and blanks are preserved. Scores are the workbook's outreach heuristic, not purchase probability: 40 base + 20 for phone + min(reviews / 50 × 20, 20) + 20 for rating ≥4.5 (10 for ≥4). Source social notes are separate from usable HTTPS profile links.
- **Re-import:** match Maps place ID first, then normalized name/address. Conflicting IDs, duplicate rows and multiple matches are flagged. Confirmed nonblank source facts update; blanks do not erase previous nonblank facts. Manual overrides, notes, shortlist, stages and projects survive. Prospect edits and existing website copy remain independently editable.
- **Editor:** change branding, images, copy, services, team, location, hours, socials, reviews, FAQs and metadata. Preview desktop/mobile and optional service/contact pages. Save before publishing or exporting. Uploaded assets are private until included in a published release.
- **Publish:** creates an immutable release. Asset links contain the release ID, so a page already open retains its matching CSS/images/fonts after an update. Old release assets remain available while the project is published. Unpublish blocks all its releases through the public route. Unknown paths return 404. Removing a link cannot revoke files someone already downloaded.
- **Export:** working draft ZIPs are noindex and demo-only. Production requires a final HTTPS origin and configured contact method. The archive includes `site/`, `source/` and instructions. Only public clinic fields and selected website assets are included; no prospect notes, credentials, Manus references or studio preview URLs. Copy `site/` contents to a normal static host with directory index serving.

## Contact methods

WhatsApp visitors review an encoded message and explicitly send it in WhatsApp. Confirm the clinic's enabled international number first. Email uses a clinic-specific Formspree ID; verify the recipient and configure allowed domains in Formspree. No SMTP secrets are needed. Forms provide validation, loading, success and failure behavior, with entries preserved on failure. They ask visitors to avoid medical records or sensitive health details. Pitch previews and unconfigured working ZIPs never send enquiries. No test sends a real enquiry to a clinic.

## SEO and AI-search deliverables

The shared renderer emits meaningful initial HTML, semantic headings, internal links, distinct page titles/descriptions, canonical and social metadata, optimized local images/fonts, and Dentist JSON-LD derived from visible supplied clinic facts. Arbitrary prose hours remain visible text; structured opening hours are emitted only for standardized values such as `Mo-Fr 09:00-18:00; Sa 09:00-13:00`. Review highlights never emit self-serving `aggregateRating`/review-star markup. Production output includes the final-domain sitemap and robots rules. Preview responses and HTML are noindex, crawlers can read that instruction, and previews are excluded from sitemaps.

Production robots allow `OAI-SearchBot` for search independently of `GPTBot` training access, which is disallowed by default. Change the GPTBot rule in `source/renderer.mjs` and rebuild if the clinic chooses another training preference; keep search access and hosting firewall rules consistent.

These are concrete deliverables, not ranking or citation guarantees. Google says its AI search features use existing SEO foundations and need no special AI markup. See [Google AI features](https://developers.google.com/search/docs/appearance/ai-features), [local-business structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business), [noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing) and [OpenAI crawler guidance](https://developers.openai.com/api/docs/bots). The ZIP's launch checklist covers Search Console verification, sitemap submission, clinic approval and updating the Google Business Profile website link.

## Code map and validation

| Path | Responsibility |
| --- | --- |
| `lib/site/` | Versioned public config, strict validation, dependency-free HTML/CSS/JS renderer |
| `lib/prospects.ts` | Cached XLSX values, provenance, matching, import preview and merge |
| `lib/server/` | Owner checks, Supabase/local adapters, image processing, publication/export preparation |
| `lib/publication.ts` | Release manifests and public path resolution |
| `lib/export.ts` | Browser ZIP assembly and dependency-free Node rebuild script |
| `components/` | Prospect workflow and structured editor |
| `supabase/migrations/` | Schema, owner authorization and Storage policies |
| `tests/` | Import/renderer/release/large-ZIP tests and focused Playwright workflows |

```powershell
npm run typecheck
npm test
npm run build
node scripts/check-production-auth.mjs
npx playwright install chromium
npm run test:browser
```

For an already installed Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable. Browser tests start a loopback development server in local mode if port 3000 is free. Stop another studio dev server first for an isolated test run. Tests covering supplied workbooks require those files at the original Downloads paths; portable core tests still run elsewhere. Test exports and screenshots are under `.cache/`. Live Supabase RLS/auth/Storage and Vercel deployment need your project credentials and a post-deploy smoke check; local tests do not substitute for those live checks.

No automatic outreach, pricing, maintenance commitments, billing, final client hosting or medical advice generation is included.
