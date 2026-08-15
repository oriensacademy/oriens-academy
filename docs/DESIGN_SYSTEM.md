# Oriens Academy Design System

This document describes the **current implemented system**. `design-system/oriens-academy/MASTER.md` and `DESIGN.md` are preserved design-history/source documents; where their earlier charcoal/gold/Newsreader direction differs, runtime tokens in `src/app/globals.css` and this file are authoritative.

## Visual Direction and Brand Assets

Oriens combines academic seriousness with calm guidance: editorial typography, warm ivory/sage surfaces, deep forest ink, thin borders, restrained shadows, compass/navigation motifs and content-relevant mathematical visuals. Avoid generic SaaS glass effects, neon color, decorative gradients, unrelated motion and childlike educational styling.

Runtime assets:

- primary logo: `public/brand/oriens-logo-v2.png`;
- alternate logo: `public/brand/oriens-logo.png`;
- icon source: `public/brand/oriens-icon.png`;
- App Router favicon: `src/app/icon.png`;
- owner originals/reference variants: `docs/references/owner-assets/`.

Use the horizontal logo with its intrinsic aspect ratio; never stretch, crop or recolor it. Use the compass React components for structural brand motion rather than scattering logo icons as decoration.

## Implemented Color Tokens

| Token | Value | Use |
|---|---:|---|
| `--background` | `#F6F8F3` | Main ivory/sage page |
| `--background-soft` | `#F9FAF6` | Quiet alternate surface |
| `--foreground`, `--ink` | `#10271B` | Primary forest text |
| `--forest` | `#0D2A1C` | Strong dark-green surfaces |
| `--card`, `--surface` | `#FFFFFF` | Cards, forms and overlays |
| `--primary`, `--accent` | `#819586` | Muted sage actions/highlights |
| `--primary-hover` | `#718678` | Primary hover |
| `--secondary` | `#A8B7AA` | Supporting sage |
| `--sage-soft` | `#E8EEE8` | Selected/soft state |
| `--warm-accent` | `#C5B58A` | Controlled warm accent |
| `--muted` | `#EFF2ED` | Muted controls/background |
| `--muted-foreground` | `#68756C` | Secondary copy |
| `--border` | `#DDE4DC` | Hairlines/card borders |
| `--input` | `#D6DED6` | Form border |
| `--destructive` | `#B91C1C` | Errors/destructive states |

Keep body contrast high and use sage primarily for actions, strokes, selection and hierarchy—not large low-contrast text blocks. The system is light-only; no supported dark theme is defined.

## Typography

Fonts are loaded with `next/font/google` in `src/app/layout.tsx`:

- **DM Serif Display 400** (`--font-display`, `--font-heading`): public headings and editorial display text;
- **Inter** (`--font-body`, `--font-sans`): paragraphs, form fields, tables and general copy;
- **Manrope** (`--font-ui`): buttons, navigation and the admin interface.

The admin shell overrides headings to Manrope 600 for operational clarity. Use tabular numerals for live counts, prices and dates. Avoid compressed tracking on long contact details; allow safe wrapping on narrow screens.

## Layout and Responsive Strategy

The reusable `.public-container` is full-width, capped at 1240px and uses `clamp(1.125rem, 4vw, 3rem)` inline padding. Pages must remain usable at the 320px body minimum. Layouts progress from one column to two/multi-column Tailwind breakpoints; interactive cards and controls use `min-w-0` and wrapping where translated copy may expand.

Section hierarchy comes from whitespace, borders and typography. Cards represent discrete content rather than wrapping every section. Mobile retains full functionality: navigation becomes a controlled drawer, carousels support touch, admin uses a mobile shell, tables acquire scroll/adaptive representations and contact actions remain reachable.

## Shape, Borders and Shadows

Implemented radii range from 6px controls through 22–24px editorial cards/overlays. The current system intentionally uses softer cards than the earliest master specification. Use existing tokens: `sm 6`, `md 10`, `lg 14`, `xl 18`, `2xl 22`, `3xl 24` pixels. Pill radii are reserved for compact chips, circular buttons and status elements.

Borders (`#DDE4DC`) do most separation work. `.shadow-editorial` is `0 8px 30px rgba(16,39,27,.045)`; hover is slightly stronger. Avoid colored glows and heavy shadows. Modals may use a stronger neutral shadow and a restrained forest translucent backdrop.

## Buttons, Cards and Forms

Primary actions use dark forest or sage with white text, Manrope semibold labels, clear focus rings and a small active translation. Secondary actions use white/ivory with a border. Buttons are never disabled by color alone and icons remain decorative unless they convey the label.

Editorial cards use white, a 1px border, 18–22px radius and restrained shadow. Pricing cards retain their deliberately offset sage shadow/rotation behavior from the owner-selected component. Admin cards are denser and use Manrope headings.

Forms pair visible labels with inputs, use 10–14px radii, clear error text and focus border/ring. Preserve consent checkboxes and Turnstile placement. Long email addresses/messages must wrap; do not reintroduce truncation. Error/success feedback must be textual and accessible, not color-only.

## Header, Navigation, Footer and Contact Rail

`Navbar.tsx` owns desktop/mobile public navigation and logo lockups. `LanguageSwitch.tsx` uses same-page localized paths via `src/lib/routes.ts`. The footer contains brand/contact/legal/consent links and must keep the complete email address visible. Social/contact rails use restrained branded motion; do not replace their approved animation when adjusting layout.

Admin navigation is separate in `AdminSidebar.tsx` and `AdminHeader.tsx`. It uses a white surface, forest text, sage active state and no version/environment footer. Internal admin navigation must use Next.js SPA navigation.

## Admin Visual System

The `.admin-shell` uses Manrope for headings and compact operational density. Status chips are semantic; tables remain the primary desktop representation, with sheets/modals for details and editing. Loading uses `AdminWaveStatus` or the auth loader only when genuinely resolving the initial session—not on routine tab focus.

Open modal/drawer state is local to stable route components. Silent token refresh must not remount the shell. The availability form may restore its non-sensitive session draft, but password/token fields must never be persisted.

## Animation Principles

Motion communicates orientation, content entry or interaction state. Use transform/opacity where possible, pause continuous work offscreen/hidden, and keep layouts stable before animation assets load. Global `prefers-reduced-motion` CSS reduces all durations to near-zero; major components additionally implement explicit static behavior.

| Component | Path / library | Behavior and timing | Responsive/performance/reduced motion |
|---|---|---|---|
| Compass loader | `brand/CompassLoader.tsx`, Motion | One-time brand introduction, then ~280ms exit; session flag skips repeats | Explicit reduced-motion/skip path; keep provider stable |
| Compass mark/wordmark/route | `brand/CompassMark.tsx`, `OriensWordmark.tsx`, `RouteLine.tsx`, Motion | Draw/settle sequences around 140–460ms; route line defaults 1.1s | Static immediately under reduced motion |
| Public page transition | `motion/PublicPageTransition.tsx`, Motion | 180ms opacity/position transition on pathname | 0ms reduced motion; does not replace internal navigation |
| Locale transition | `brand/LanguageTransitionProvider.tsx` | Preserves form/scroll state around locale navigation; 700ms fallback | Password inputs excluded from restoration |
| Reveal / Stagger | `motion/Reveal.tsx`, `Stagger.tsx`, Motion | Reveal default 550ms; stagger item ~450ms | Viewport triggered; zero-duration reduced motion |
| Hero | `sections/Hero.tsx`, Motion | Ordered 350–500ms entrance with 50ms steps | Loader/reduced-motion state can skip motion |
| TextReveal | `text-reveal.tsx`, `ui/oriens-text-reveal.tsx`, Motion | Segment reveal with configurable base duration/stagger | Oriens wrapper sets static reduced-motion output |
| TextRotate | `ui/oriens-text-rotate.tsx` / owner source | Interval-based hero exam label, 300ms vertical swap | Interval disabled under reduced motion in Oriens wrapper |
| CountingNumber | `ui/counting-number.tsx`, Motion value | Admin count tween defaults to 3s | Admin-only and real data; avoid public unverified metrics |
| HowItWorks | `how-it-works.tsx`, Motion/CSS | In-view path/step animation; path duration 3s, card hover 300ms | Cards stack and remain readable without animation |
| Phone carousel | `ui/phone-mockups-1-utils/phone-carousel.tsx`, Motion | 4s autoplay; 350ms slide, swipe/arrows/dots | Intersection/visibility pause; touch-pan-y; static operability remains |
| 3D exam carousel | `ui/three-d-exam-carousel.tsx`, Motion values | Drag rotation; auto advance after 5.2s idle; 250ms settle; 200ms modal | Intersection pause, reduced-motion settle 0ms, focus restored on close |
| Testimonials | `ui/circular-testimonials.tsx`, Motion | Autoplay and 300ms panel transition; word reveal ~220ms | Autoplay stops for reduced motion; keyboard controls/focus ring |
| Lottie | `ui/OriensLottie.tsx`, DotLottie | Plays/loops only in view and visible; per-use speed 0.85–0.9 typical | DPR/player managed by library; first frame under reduced motion |
| Study globe | `discovery/StudyDestinationGlobe.tsx`, D3 + Canvas | Continuous rotation; 900ms region camera; drag/hover; 2s resume delay | DPR capped 1.25 mobile/1.5 desktop, far-side culling, observer/visibility pause, no auto rotation reduced motion |
| Wave loader | `ui/wave.tsx`, CSS | Repeating bars use `--duration` default 1s | Global reduced-motion rule collapses repetition |
| Hover/focus transitions | UI/section components, CSS | Mostly 200–300ms color/transform/shadow | `motion-reduce` variants/global rule remove motion |

To change timing, modify the owning component constant/transition rather than introducing a global multiplier. To disable an autoplay system, retain manual controls and visibility cleanup. Test at 320/390/430px and with reduced motion enabled.

## Lottie and Owner Assets

Runtime files live in `public/animations`: learning, exams preparation, green calculator, science and Erlenmeyer flask. They are local—no runtime third-party fetch. `docs/references/owner-assets` preserves the supplied source copies and logo variants. Keep the runtime filenames stable or update every mapping in `src/data/exam-visuals.ts` and component usage.

## Accessibility

- a skip link targets `#main-content`;
- keyboard focus uses visible ring states;
- modal implementations must preserve focus/close semantics;
- interactive canvases/carousels retain labelled controls or equivalent region buttons;
- Lottie canvases are removed from keyboard navigation and receive text labels;
- `prefers-reduced-motion` is supported globally and in continuous components;
- localized content and labels must remain complete at mobile widths;
- color is not the only status/error indicator.

## Component Sources and Design References

Do not reinstall a registry component over the customized production source. Compare against the original and reapply Oriens adaptations deliberately. Source URLs, commands, providers and known attribution status are in `docs/COMPONENT_REFERENCES.md`. The Sage Garden Remix reference and historical runtime audits remain preserved under `docs/`; the full original brand rationale remains in `design-system/oriens-academy`.
