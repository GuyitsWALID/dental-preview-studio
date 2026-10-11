# OLI Dental Clinic website — plan

## Product scope and research decision
Build a polished, responsive prospect-demo website for OLI Dental Clinic, including the home/landing page and the dedicated contact page originally requested. The **Home page contains the Google Maps panel and demo-only contact form** in one contact block; point `#visit` directly to this map/form block. Remove the extra blue “Find OLI / Your next conversation is close by” strip and the white “We are here to help / Let’s talk about your smile / See all contact details” call-to-action block. Keep the verified address/directions within the map panel beside the form, following the user's supplied layout reference. The page's Contact navigation, “Meet us in Megenagna,” and footer links all scroll to this block via `#visit`; none route a visitor away from Home. `/contact/` remains directly available and mirrors the same contact content. Both forms are preview-only: they never transmit or store entries and, after submit, offer verified call/social options. No appointment backend, patient records, business email, booking availability, clinician biographies, clinical guarantees or unverified contact channels will be invented.

**Prospect rationale:** OLI is a strong lead from the supplied September 2026 workbook: 4.9/5 from 47 Google Maps reviews, an absent standalone website and a high 98.8 lead score. The current (7 Oct 2026) Google listing independently displays 4.9/47 and prompts “Add website”; the public Dentists10 listing links to Facebook, not an owned site. Current first-party social content shows ongoing promotions and appointment contact. These facts suggest an owned-site gap and marketing activity, but willingness and ability to pay remain unknown.

**Current shortlist check:** Two workbook leads with higher raw scores—Mina Dent (4.9/68; 100) and Dr. Milky Derara (5.0/109; 100)—have publicly discoverable standalone sites. Harla (5.0/44) has harla.co and Green Life (4.9/39) has greenlifethiopia.com. OLI's 4.9/47 rating remains high, and the strongest fit is its current website gap plus active first-party marketing. These are commercial-fit signals, not evidence that OLI will buy.

## Design direction: OLI Brand / Cobalt Precision
- **Design movement:** Contemporary clinical modernism, with clean geometry and an editorial rhythm anchored to OLI's blue–yellow–cyan identity.
- **Core principles:** Clarity at a glance; calm, confident expertise; direct action paths; accessible contrast and legibility.
- **Color philosophy:** Use OLI's supplied logo palette: optimistic sun-yellow `#F7DC43`, deep trusted blue `#0C457B`, and bright cyan `#1FA8D6`; retain soft ivory/white surfaces so yellow CTAs and navy text stay readable.
- **Layout paradigm:** Asymmetric split hero and offset sections. Home `#visit` opens directly at the user's reference layout: map/location on the left and request-form card on the right. Do not surround it with the redundant blue location banner or closing callout; keep the about section text-led.
- **Layout paradigm:** Asymmetric split hero and offset sections. The Home `#visit` destination is only the user's reference layout: map/location on the left and request-form card on the right, with the address and directions inside the map panel. Do not place a separate blue location banner or closing callout around this block. Keep the about section text-led.
- **Signature elements:** The exact circular tooth-and-braces logo; crisp yellow/blue rules; small rating/contact chips.
- **Interaction philosophy:** Phone/social links are direct. Contact navigation scrolls to the home location/form block. Both demo-only forms truthfully reveal call/social options and never send or store visitor entries. Review movement pauses on hover/focus, offers pause/resume and honors reduced-motion preferences.
- **Animation:** Reviews move in a continuous full-cycle 360° loop; hover, keyboard focus or the control pauses it. Reduce motion to a static, scrollable carousel when `prefers-reduced-motion` is enabled. Keep all other transitions restrained; motion must never delay access to content.
- **Typography:** Plus Jakarta Sans for display and body, with system sans-serif fallback; measured headings, medium-weight labels and relaxed patient-facing copy.
- **Brand essence:** “Modern dental care, with a personal touch, in Megenagna.” Personality: precise, reassuring, contemporary.
- **Brand voice:** Warm, plain-language, confident, never overpromising. Example lines: “A healthier smile starts with a simple conversation.” “Not ready to call? Use this contact-form preview to see your options.”
- **Wordmark/logo:** Use the exact user-supplied circular OLI Dental Clinic logo from managed storage `/manus-storage/images_95900612.jpeg`, unaltered, alongside accessible live text.
- **Signature brand color:** OLI sun-yellow `#F7DC43`, paired with logo-blue `#0C457B` and cyan `#1FA8D6`.

## Pages and verified business content
1. **Home (`/`)** — hero with click-to-call CTA; source-supported services; live-checked rating (`4.9/5`, `47` reviews, as observed 7 Oct 2026); an auto-rotating Google-linked carousel of brief excerpts from three public five-star reviews. Cards make a continuous 360° loop, stop on hover/focus, have pause/resume control and honor reduced-motion preferences. Use the official OLI cover and one labelled illustrative treatment-room hero image; leave the about section text-led. Make the map/form pair the single Home contact section, with verified location, direct directions, phones and the exact OLI map at `9.0209025, 38.7969129`. Remove the extra blue visit strip and closing “We are here to help” panel. Contact nav, “Meet us in Megenagna,” and footer contact links target `#visit`.
2. **Contact (`/contact/`)** — retain the complete location/map-left, demo-form-right page originally requested. The map is embed code generated from OLI's exact Maps listing; directions use place ID `ChIJ4QgBpN-FSxYRJ5jCJGsvjwk`. Display Grace City Mall, 3rd Floor, Kenenisa Ave, Megenagna; phones `+251 942 438 888` and `+251 966 263 667`; Instagram, Facebook and TikTok. The Contact navigation and footer link return to `/#visit` on Home. Preserve both hour listings (directory Mon–Sat 09:00–18:00; Google Wednesday 09:00–18:30; Sunday unlisted) with a call-ahead note. No email is displayed. Form entries are not sent or stored; after submission they clear and visitors see verified clinic options. Do not invite sensitive health information.
3. **Footer/socials:** Link Instagram, the verified OLI Facebook page and verified OLI TikTok profile `@oli_dental_clinic` (https://www.tiktok.com/@oli_dental_clinic). Do not add X/Twitter.
4. **Review status:** Retain “Website concept — for clinic review” plus verification/photo-permission notes. Review quotes stay linked to Google Maps; no medical outcomes are claimed.

## Implementation approach and project structure
Use a lightweight static website. Plain HTML, CSS and a small JavaScript module keep maintenance low; no server/database/email integration is available or requested. Form behavior remains client-side and non-transmitting. Serve on the project's configured Cloud Preview port `3000`, bound to `0.0.0.0`.

- `/index.html`: landing page, Google-review carousel, and full `#visit` map/form/contact destination.
- `/contact/index.html`: directly addressable map-left/form-right Contact page.
- `/styles.css`: responsive layouts, brand palette, carousel motion/pause/reduced-motion treatments, and map/form styles.
- `/main.js`: accessible mobile navigation, review pause/resume, non-transmitting demo-form behavior for either page.
- `/public/assets/oli-facebook-cover.jpg`: local source copy of the public clinic cover; website uses `/manus-storage/oli-facebook-cover_c9bd08af.jpg`.
- `/manus-storage/async-images/wylWEvFOfztq9uDggHmKgh/image-1.webp`: single labelled illustrative hero photo; intentionally not reused in another section.
- `/manus-storage/images_95900612.jpeg`: exact supplied OLI logo, unmodified.
- `/manus-routes.json`: route manifest for `/` and `/contact/`.
- `/RECOMMENDATION.md`, `/plan.md`, `/TODO.md`: research evidence, implementation plan and outcome tracker.

The site remains static and Preview-only. No clinic account, patient submissions, public release or domain settings are changed.

## Evidence and constraints
- User-provided workbook: `Copyofaddis_ababa_dental_outreach_ready.xlsx`, `Outreach Ready` tab (Summary dated 2026-09-20).
- Google Maps review excerpts checked against the live public listing on 7 Oct 2026; the 4.9/47 rating is linked to its source and can change.
- OLI Maps listing: https://www.google.com/maps/search/?api=1&query=Oli+Dental+Clinic%2C+Addis+Ababa%2C+Ethiopia&query_place_id=ChIJ4QgBpN-FSxYRJ5jCJGsvjwk
- OLI's TikTok profile `@oli_dental_clinic` displays the clinic name, Megenagna/Grace City Mall, third-floor location and both published phone numbers; Instagram/Facebook profiles and posts also verify contact details. The public Facebook cover is reused for review; owner permission is still required before launch.
- All landing-page Contact links point to the Home `#visit` block, which now includes both the exact OLI map and the form.
- Google Maps lists Wednesday to 18:30 while Dentists10 gives 18:00; preserve the discrepancy and advise confirmation. Do not collect or save visitor form details. The generated hero image is explicitly identified as illustrative.
