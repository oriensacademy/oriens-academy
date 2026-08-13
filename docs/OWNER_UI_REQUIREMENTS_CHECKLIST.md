# Oriens Academy — Owner UI Requirements Checklist

Audit date: 2026-08-13. `VISIBLE` means verified in a real Chromium render. `FUNCTIONAL` means the local implementation and browser interaction worked. Items requiring unapplied database/function changes are deliberately not marked complete.

| Owner requirement | Source | Integrated | Visible | Functional | Tested / evidence |
|---|---:|---:|---:|---:|---|
| Owner web icon | YES | YES | YES | YES | Source bytes copied to public brand, App Router icon and Apple icon; generated ICO returns 200. |
| Canonical phone, WhatsApp and email | YES | YES | YES | YES | Shared typed contact config; exact `tel:`, `wa.me` and `mailto:` links found in browser. |
| Premium footer contact block | YES | YES | YES | YES | Instagram, WhatsApp, phone and email rendered with legal links in TR/EN. |
| Four-channel floating contact dock | YES | YES | YES | YES | Desktop dock and compact mobile expandable control rendered and keyboard-accessible. |
| Delayed randomized contact nudge | YES | YES | CONDITIONAL | YES | 28-second timer, approved localized copy, explicit close and once-per-session suppression. |
| Six enlarged student concerns | YES | YES | YES | YES | Six interactive buttons and selected answer state exercised in Chromium. |
| Real testimonial carousel | YES | YES | CONDITIONAL | BLOCKED | Component, arrows, snap navigation, expandable modal and verified-only query exist. Remote table lacks the unapplied anon SELECT grant, so the section safely hides rather than showing fake content. |
| Testimonial admin/profile image field | YES | YES | AUTH REQUIRED | BLOCKED | Admin CRUD code and migration exist; authenticated mutation and unapplied schema migration were not run. |
| Contact-first page hierarchy | YES | YES | YES | YES | Contact details and form occupy the first meaningful viewport on mobile and desktop. |
| New-request form reset | YES | YES | YES | YES | Existing success reset is preserved without a full-site reload. |
| Quick contact lead | YES | YES | CONDITIONAL | PARTIAL | 45-second, desktop-only, session-suppressed UI uses the shared contact submitter. Its new `source` field requires the intentionally unapplied local migration/function deployment. |
| Localized transactional emails | YES | YES | N/A | PARTIAL | Seven delivery variants were source-audited, escaped, branded and locale-aware. Live delivery was not run because doing so requires deploying the modified Edge Functions or exposing production credentials. |
| Five-step student journey | YES | YES | YES | YES | Five cards, dashed progression path and responsive stacking are rendered. |
| Student journey reduced motion | YES | YES | YES | YES | Motion paths/cards switch to static state under reduced-motion preference. |
| Hero TextReveal | ADAPTED | YES | YES | YES | Stable word-level reveal uses opacity/transform and maintains readable line wrapping. |
| Hero TextRotate exam cue | ADAPTED | YES | YES | YES | IB/SAT/AP/ESAT/TMUA/IGCSE cycle in a reserved-width inline region. |
| Initial owner-icon loader | YES | YES | YES | YES | Session-once icon and Wave loader; no artificial locale-navigation delay. |
| Smooth language transition | YES | YES | YES | YES | Shared TR/EN segmented control, delayed loader threshold and route completion cleanup tested. |
| Six subject visual systems | ADAPTED | YES | YES | YES | Mathematics, physics, chemistry, biology, geography and history motifs render from one lightweight SVG system. |
| Reduced repeated math graphs | YES | YES | YES | YES | Generic exam grid parabola and booking graph backdrop removed; subject motifs replace them. |
| Mobile-first behavior | YES | YES | YES | YES | No horizontal overflow at 360, 375, 390, 430, 768, 1280, 1440 and 1920 widths. |
| Legal pages/footer links | YES | YES | YES | YES | TR/EN privacy and terms pages render through the shared layout. |
| Admin pricing/testimonials | YES | YES | AUTH REQUIRED | PARTIAL | Protected routes redirect correctly; owner-authenticated edits were not claimed without credentials. |
| Production safety | YES | YES | N/A | YES | No push, deploy, DNS change, remote migration or production data mutation performed. |

## Open operational items

1. Apply the reviewed Supabase migrations in a separately authorized deployment window. This restores public verified-testimonial reads and adds `profile_image_url`/quick-contact source persistence.
2. Deploy the reviewed Edge Function updates, then send the documented synthetic TR/EN matrix to the owner-provided inbox and delete the synthetic rows after verification.
3. Repeat authenticated testimonial management and notification-recipient checks with an owner admin session.
