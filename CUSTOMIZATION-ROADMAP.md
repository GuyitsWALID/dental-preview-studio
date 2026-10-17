# Customization roadmap

Ideas to turn the studio into a top-tier customization tool. Grounded in the current
architecture: one renderer (`lib/site/renderer.mjs`) + CSS variables (`lib/site/styles.mjs`)
+ a whitelisted config (`validateSiteConfig`). Anything that is "new theme/appearance field
+ CSS var + validation + test" is cheap and low-risk; anything touching the render/export
pipeline is a bigger milestone.

Effort key: **S** small (~an hour), **M** medium (half day), **L** large (a day+).

## A. Theme & visual system — cheapest, biggest perceived jump
- **More colour slots**: heading, body text, muted text, borders/lines, button text, nav links, badge — each a CSS var with the current colour as fallback. **S**
- **Custom radius amount** (slider, replaces the 3 corner presets) and **custom container width** (boxed vs full-bleed). **S**
- **Heading/body font split** + more bundled fonts (add woff2 in `scripts/prepare-fonts.mjs`), weight and letter-spacing. **M–L** (font files = size)
- **Type & spacing scale sliders** (base font size, section padding). **S**
- **Dark mode / second palette** — second set of colour vars + a toggle (or auto via `prefers-color-scheme`). **M**
- **Gradients**: two-colour gradient + angle picker for hero/section (extends today's hero gradient). **M**
- **Button style** (pill/rounded/square, solid/outline/ghost) and **shadow/elevation amount**. **S**
- **Header variants** (sticky vs static, transparent vs solid, centered logo, nav position). **M**

## B. Section & layout controls
- **Per-section layout variants**: services 2/3/4-column or list, about image left/right, reviews carousel vs grid, FAQ one/two-column, contact map left/right. **M**
- **Per-section tint on/off** + eyebrow/subheading toggles per section. **S**
- **Hero variants**: image / background image with overlay / no-image, plus **image focal point & overlay opacity**. **M**
- **Service icons** (pick from a bundled set) and icon style. **M**
- **Team/clinicians as a real section** with photos and roles (today it is name + credentials text). **M**

## C. Editor power features (the "pro tool" feel)
- **Undo/redo + autosave + version history**. **M**
- **Click-to-edit text directly in the preview** (the single biggest wow for pitching). **L**
- **Drag-and-drop section reorder** (upgrade the up/down buttons). **M**
- **Live WCAG contrast warnings** with a one-click "fix" when a colour pair is unreadable. **M**
- **More preview breakpoints** (tablet + custom widths) and reset-to-default per control. **S**

## D. Assets & media
- **Reusable asset library** across projects + a placeholder/stock image picker. **M**
- **Logo variants (light/dark), favicon upload, OG image upload**. **S–M**
- **Focal-point crop editor** for hero/cover images. **M**
- **Custom font upload** (woff2). **M**

## E. Templates & reuse
- **Save current look as a reusable theme/preset** and apply across projects (today: 3 hardcoded presets). **M**
- **Start-from-template gallery** + duplicate project. **M**

## F. SEO / technical
- Per-page SEO editors, structured-data type choice (Dentist/MedicalClinic), OG title/description, multi-language toggle. **S–L**

## G. Publishing & pitch tools
- **Preview QR code** (open the pitch on the client's phone in the room) — high impact for a pitch tool. **S**
- Password/expiry on share links, basic view counts. **M**
- One-page **PDF export** and a social share image. **M**

## H. Content assistance
- AI copy generation per section, tone control, translation; auto-fill more from Maps. **L**

---

## Recommended first batch

Best value-to-risk, all fitting the existing "theme field + CSS var + validation + test" pattern:

- A: extra colour slots, custom radius + container width, type/spacing sliders
- B: per-section tint + layout variants
- G: preview QR code
- C: undo/redo

This turns the tool from "pick a colour" into a genuinely customisable product without
touching the render/export architecture.

## Notes / risks

- Ones with architecture impact (dark mode, click-to-edit, custom fonts, i18n) touch the
  renderer, the validation whitelist, export and tests — treat each as its own milestone.
- Added font files grow the exported ZIP.
- New config fields must be added to `validateSiteConfig` shape + hex/format checks,
  `lib/site/renderer.d.mts`, `lib/site/types.ts`, and covered by a test. The route persists
  nested `theme.*` automatically (top-level whitelist).
