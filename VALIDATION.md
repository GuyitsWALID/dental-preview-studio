# Validation record

Implementation checked on 11 October 2026 with Node.js 24 and Chromium on Windows.

- Production build and TypeScript checks pass.
- Six core tests pass: both real workbooks, cached formulas and ambiguity, clinic isolation/escaping, production SEO metadata, immutable preview resolution/unpublishing, and ZIP source rebuilding.
- Both supplied workbooks resolve to 49 default prospects, including 13 high priority. Re-importing preserves OLI's **Proposal requested** stage and manual notes/overrides; missing emails remain missing and descriptive social notes do not become URLs.
- Four focused browser checks pass: owner import/editor/save/publish/export/unpublish and failed publication; raster validation; mocked WhatsApp and email success/failure; a browser ZIP over 4.5 MB rebuilt and navigated on a normal static host with dashboard access blocked.
- Service/contact navigation checked under published preview paths and on the independent static host.
- Mobile overflow, keyboard tab navigation/menu controls, reduced motion and default text contrast reviewed. Branding colors remain owner-editable and should be checked again for each clinic.
- Production anonymous-access check passes using deliberately fake Supabase settings: dashboard redirects to login; prospect records, assets, editing, imports, uploads and exports return 401. Local demo mode cannot bypass production authentication.
- Thirteen production server traces checked: local prospect data, browser artifacts and test exports are excluded.
- Dependency audit after the ExcelJS UUID update reported zero vulnerabilities.

No real clinic enquiries were sent. External services were mocked during browser checks.

## Live checks still required

Supabase project `uthezgsugniytqkheqig` was connected on 11 October 2026. The initial schema and private-owner-helper migrations were applied. Live checks confirmed RLS on both tables, a private 5 MB Storage bucket, no anonymous function execution/schema access, and no public owner-helper RPC. A transaction impersonating an authenticated non-owner confirmed that owner authorization is false, workspace reads return no rows, and workspace inserts are denied. The security advisor reports no warnings; its sole informational finding is the intentional absence of direct client policies on the owner registry.

The project URL, publishable key, server secret key and owner UUID are configured in the ignored local environment file, with local demo mode disabled. The requested owner Auth account and owner-registry entry are created. The 49 local prospects, OLI draft and its private cover image were transferred into Supabase, preserving the **Proposal requested** stage. Live owner password sign-in, owner RLS reads, private Storage downloads, studio HTTP-only session cookies, authenticated dashboard/asset access and authorized export image downloads all pass; anonymous workspace/asset access is denied. Test sessions were signed out without displaying credentials or cookies.

Supabase's public signup setting is still enabled and must be disabled in Authentication settings; the available MCP tools do not expose that configuration. The app already rejects every account other than the configured owner. Vercel deployment, live Formspree recipient verification, final clinic fact approval, domain/DNS setup, Search Console and Google Business Profile updates remain part of the manual launch workflow.
