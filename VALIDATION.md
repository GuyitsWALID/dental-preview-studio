# Validation record

Implementation checked on 11 October 2026 with Node.js 24 and Chromium on Windows.

- Production build and TypeScript checks pass.
- Sixteen core tests pass, including the audit regressions and enriched-workbook checks. Original coverage: both real workbooks, cached formulas and ambiguity, clinic isolation/escaping, production SEO metadata, immutable preview resolution/unpublishing, and ZIP source rebuilding.
- Both supplied workbooks resolve to 49 default prospects, including 13 high priority. Re-importing preserves OLI's **Proposal requested** stage and manual notes/overrides; missing emails remain missing and descriptive social notes do not become URLs.
- Seven audit browser checks passed before the enriched-workbook extension, covering unsaved navigation guards, saved-draft key-order handling, bounded 2,000-row import/confirmation and the original workflows: owner import/editor/save/publish/export/unpublish and failed publication; raster validation; mocked WhatsApp and email success/failure; a browser ZIP over 4.5 MB rebuilt and navigated on a normal static host with dashboard access blocked.
- Service/contact navigation checked under published preview paths and on the independent static host.
- Mobile overflow, keyboard tab navigation/menu controls, reduced motion and default text contrast reviewed. Branding colors remain owner-editable and should be checked again for each clinic.
- Production anonymous-access check passes using deliberately fake Supabase settings: dashboard redirects to login; prospect records, assets, editing, imports, uploads and exports return 401. Local demo mode cannot bypass production authentication.
- Thirteen production server traces checked: local prospect data, browser artifacts and test exports are excluded.
- Dependency audit after the ExcelJS UUID update reported zero vulnerabilities.

No real clinic enquiries were sent. External services were mocked during browser checks.

## Live checks still required

Supabase project `uthezgsugniytqkheqig` was connected on 11 October 2026. The initial schema and private-owner-helper migrations were applied. Live checks confirmed RLS on both tables, a private 5 MB Storage bucket, no anonymous function execution/schema access, and no public owner-helper RPC. A transaction impersonating an authenticated non-owner confirmed that owner authorization is false, workspace reads return no rows, and workspace inserts are denied. The security advisor reports no warnings; its sole informational finding is the intentional absence of direct client policies on the owner registry.

The project URL, publishable key, server secret key and owner UUID are configured in the ignored local environment file, with local demo mode disabled. The requested owner Auth account and owner-registry entry are created. The 49 local prospects, OLI draft and its private cover image were transferred into Supabase, preserving the **Proposal requested** stage. Live owner password sign-in, owner RLS reads, private Storage downloads, studio HTTP-only session cookies, authenticated dashboard/asset access and authorized export image downloads all pass; anonymous workspace/asset access is denied. Test sessions were signed out without displaying credentials or cookies.

Supabase's public signup setting was verified disabled (`disable_signup: true`) through the Auth settings API on 11 October 2026. Private import staging upload/list/download/removal also passed against the existing bucket; the temporary verification object was removed. The app already rejects every account other than the configured owner. Vercel deployment, live Formspree recipient verification, final clinic fact approval, domain/DNS setup, Search Console and Google Business Profile updates remain part of the manual launch workflow.

## Audit fixes and upgraded workbook

All six must-fix findings have implementations: unsaved sidebar/back/sign-out guards; explicit international phone prefixes; private staged, paged imports with small confirmation requests and streamed workspace reads; XLSX hyperlink targets preserved alongside labels; public signup disabled; and contact links omitted when their destination is hidden.

The four improvements are implemented: publication rollback waits for all uploads before removing attempted files; blank social profiles are omitted from structured data; browser tests launch fresh isolated demo data with a dedicated server/build directory and refuse existing servers; Escape returns focus to the mobile menu button. Six inactive prototype files were removed, and obsolete prototype instructions were retired.

The upgraded workbook imports 49 clinic details, 27 paraphrased review summaries (9/10/8 across three clinics) and asset references with source rows and collection dates. Tests confirm OLI has no collected review text in the new file, cross-clinic records are rejected, reimports do not duplicate or erase collected reviews, and website content stays unchanged until selected in the editor. Legacy review configuration remains valid; summaries, source context and supplied individual stars render as public text without review-rating JSON-LD.

All nine browser scenarios have passed: eight in the full-suite run, then both review scenarios in a focused rerun after correcting test selectors. The new checks cover selecting and confirming one imported summary, saving/publishing it, exporting only public fields, seamless carousel wrapping, pause/manual controls, inert duplicate cards, reduced motion and mobile overflow. The final application also passed the production build, TypeScript checks and production anonymous-access check. These changes remain local; the deployed Vercel application has not been updated.
