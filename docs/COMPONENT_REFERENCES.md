# Component References

Permanent source/restoration index for externally sourced or heavily customized production components. The local files are the production source of truth. Do **not** reinstall over them; use the commands only to obtain a comparison copy and manually preserve Oriens behavior, data adapters, accessibility and visual styling.

## Creative Pricing

Current local path: `src/components/ui/creative-pricing.tsx`; Oriens adapter `src/components/ui/oriens-creative-pricing.tsx`  
Original source: 21st.dev registry component `kokonutd/creative-pricing`  
Author/provider: kokonutd / 21st.dev  
Original URL: https://21st.dev/r/kokonutd/creative-pricing  
Installation command: `npx shadcn@latest add "https://21st.dev/r/kokonutd/creative-pricing"`  
Dependencies: React, Tailwind CSS, Lucide, Motion in the adapted surface  
Used on: `src/components/pricing/PricingPage.tsx`; TR/EN pricing routes  
Oriens-specific changes: database package adapter, five lesson packages, localized labels, lira formatting, package query CTAs, sage/forest palette, controlled rotations and offset shadow, mobile overflow fixes  
License/attribution notes: No component-local license header was recoverable; retain this source reference and review upstream terms before redistribution outside this project.

## Text Rotate

Current local path: `src/components/ui/text-rotate.tsx`; production wrapper `src/components/ui/oriens-text-rotate.tsx`  
Original source: 21st.dev CLI slug `danielpetho/text-rotate`  
Author/provider: danielpetho / 21st.dev  
Original URL: Unknown / not recoverable; installation slug preserved  
Installation command: `npx @21st-dev/cli add danielpetho/text-rotate`  
Dependencies: React, Motion  
Used on: `src/components/sections/Hero.tsx`  
Oriens-specific changes: localized exam labels, restrained vertical transition, reduced-motion handling and typography integration  
License/attribution notes: No local license header found; preserve provider/slug attribution.

## Text Reveal

Current local path: `src/components/text-reveal.tsx`; wrapper `src/components/ui/oriens-text-reveal.tsx`  
Original source: 21st.dev CLI slug `cnippet.dev/text-reveal`  
Author/provider: cnippet.dev / 21st.dev  
Original URL: Unknown / not recoverable; installation slug preserved  
Installation command: `npx @21st-dev/cli add cnippet.dev/text-reveal`  
Dependencies: React, Motion  
Used on: homepage hero  
Oriens-specific changes: DM Serif typography, segment timing, loader-aware entry and explicit reduced-motion behavior  
License/attribution notes: No local license header found; preserve provider/slug attribution.

## How It Works

Current local path: `src/components/how-it-works.tsx`  
Original source: 21st.dev CLI slug `chamaac/how-it-works`  
Author/provider: chamaac / 21st.dev  
Original URL: Unknown / not recoverable; installation slug preserved  
Installation command: `npx @21st-dev/cli add chamaac/how-it-works`  
Dependencies: React, Motion, Lucide  
Used on: `src/components/sections/StudentJourney.tsx`; TR/EN home  
Oriens-specific changes: five localized academic steps, ivory/sage styling, restrained card angles, animated route path and mobile stack  
License/attribution notes: No local license header found; preserve provider/slug attribution.

## 3D Carousel

Current local path: `src/components/ui/3d-carousel.tsx`; production exam implementation `src/components/ui/three-d-exam-carousel.tsx`  
Original source: Cult UI component through 21st.dev registry  
Author/provider: Cult UI / 21st.dev  
Original URL: https://21st.dev/r/cult-ui/3d-carousel  
Installation command: `npx shadcn@latest add "https://21st.dev/r/cult-ui/3d-carousel"`  
Dependencies: React, Motion, Lucide  
Used on: `src/components/exams/ExamHub.tsx`; TR/EN exam hubs  
Oriens-specific changes: real exam data, no demo imagery, drag and idle rotation, visibility pause, accessible detail dialog/focus restoration, responsive sizing and reduced motion  
License/attribution notes: Provider attribution retained; check upstream Cult UI/registry license if extracting the component.

## Testimonials Section

Current local path: `src/components/testimonials-section.tsx`; UI helpers include `src/components/ui/circular-testimonials.tsx` and `testimonials-columns-1.tsx`  
Original source: 21st.dev CLI slug `sshahaider/testimonials-section`  
Author/provider: sshahaider / 21st.dev  
Original URL: Unknown / not recoverable; installation slug preserved  
Installation command: `npx @21st-dev/cli add sshahaider/testimonials-section`  
Dependencies: React, Motion, Lucide  
Used on: `src/components/sections/ResultsTestimonials.tsx`; public home/about surfaces  
Oriens-specific changes: verified Supabase/localized testimonials, fake remote avatars removed, fallback initials, keyboard carousel, reduced-motion autoplay behavior  
License/attribution notes: No local license header found; preserve provider/slug attribution.

## Phone Mockups 1

Current local path: `src/components/ui/phone-mockups-1.tsx`, `src/components/ui/phone-mockups-1-utils/phone-carousel.tsx`  
Original source: 21st.dev CLI slug `solaceui/phone-mockups-1`  
Author/provider: Solace UI / 21st.dev  
Original URL: Unknown / not recoverable; installation slug preserved  
Installation command: `npx @21st-dev/cli add solaceui/phone-mockups-1`  
Dependencies: React, Motion, Lucide  
Used on: homepage hero  
Oriens-specific changes: owner-approved academic slides, four-second autoplay, swipe/arrows/dots, offscreen/tab pause, Oriens phone shell and responsive dimensions  
License/attribution notes: No local license header found; preserve provider/slug attribution.

## Counting Number

Current local path: `src/components/ui/counting-number.tsx`; related project counter `src/components/motion/Counter.tsx`  
Original source: 21st.dev CLI slug `cnippet.dev/counting-number`  
Author/provider: cnippet.dev / 21st.dev  
Original URL: Unknown / not recoverable; installation slug preserved  
Installation command: `npx @21st-dev/cli add cnippet.dev/counting-number`  
Dependencies: React, Motion  
Used on: authenticated admin dashboard counts  
Oriens-specific changes: real database metrics only, admin typography and responsive cards; deliberately not used for unverifiable public claims  
License/attribution notes: No local license header found; preserve provider/slug attribution.

## Marketing Badges

Current local path: `src/components/marketing-badges.tsx`; wrapper `src/components/ui/oriens-marketing-badges.tsx`  
Original source: 21st.dev CLI slug `jatin-yadav05/marketing-badges`  
Author/provider: jatin-yadav05 / 21st.dev  
Original URL: Unknown / not recoverable; installation slug preserved  
Installation command: `npx @21st-dev/cli add jatin-yadav05/marketing-badges`  
Dependencies: React, Motion, Lucide  
Used on: `src/components/sections/StudentQuestions.tsx`  
Oriens-specific changes: six localized student concerns, selected explanatory content/CTA, removed agency vocabulary, sage states and reduced motion  
License/attribution notes: Owner-selection comment is retained in source; preserve provider/slug attribution.

## Gradient Card

Current local path: `src/components/gradient-card.tsx`; wrapper `src/components/ui/oriens-gradient-card.tsx`  
Original source: 21st.dev CLI slug `ravikatiyar162/gradient-card`  
Author/provider: ravikatiyar162 / 21st.dev  
Original URL: Unknown / not recoverable; installation slug preserved  
Installation command: `npx @21st-dev/cli add ravikatiyar162/gradient-card`  
Dependencies: React, Lucide  
Used on: `src/components/sections/ExamPreparation.tsx`  
Oriens-specific changes: verified exam groups, editorial white/sage cards, restrained shadow/hover and localized routes  
License/attribution notes: Owner-selection comment is retained in source; preserve provider/slug attribution.

## shadcn-Compatible UI Primitives

Current local path: `src/components/ui/{button,input,label,checkbox,switch,tooltip,tabs,accordion,textarea,separator}.tsx` and `components.json`  
Original source: shadcn CLI/component model  
Author/provider: shadcn  
Original URL: https://ui.shadcn.com/docs/components  
Installation command: Component-specific commands are not recoverable; configuration is preserved in `components.json` (`base-nova`, Tailwind CSS variables, Lucide). Use `npx shadcn@latest add <component>` only in a review branch.  
Dependencies: Base UI/Radix packages, class-variance-authority, clsx, tailwind-merge, Lucide  
Used on: public forms, navigation and admin controls  
Oriens-specific changes: semantic sage/forest tokens, Manrope UI type, focus and directional-arrow behavior, Tailwind 4 integration  
License/attribution notes: shadcn component source is project-owned copy; retain any upstream headers that appear in future updates.

## Sage Garden Remix Theme Reference

Current local path: implemented tokens in `src/app/globals.css`; historical decision record `docs/SAGE_GARDEN_REMIX_THEME.md`  
Original source: Sage Garden Remix theme  
Author/provider: abenezeryohannes / 21st.dev  
Original URL: https://21st.dev/@abenezeryohannes/themes/sage-garden-remix-1782568612746  
Installation command: Unknown / not recoverable  
Dependencies: Tailwind CSS/shadcn-compatible CSS variables  
Used on: global public/admin palette  
Oriens-specific changes: tokens were substantially adapted to the current ivory/sage/forest academic system  
License/attribution notes: Source URL retained; review source terms before reuse outside Oriens.

## Other Production Libraries

| Package | Purpose | Main location | Notes |
|---|---|---|---|
| `next`, `react`, `react-dom` | App Router/runtime | `src/app` | Netlify runtime, not static export |
| `tailwindcss`, `tw-animate-css` | Utility styling/motion | `src/app/globals.css` | Tailwind 4 PostCSS |
| `motion` | React motion primitives | brand/motion/UI components | Imported as `motion/react`; `framer-motion` is not installed |
| `lucide-react`, `react-icons` | Icons | component source | Prefer Lucide for new Oriens UI |
| `@lottiefiles/dotlottie-react` | Local Lottie playback | `OriensLottie.tsx` | Owner assets in `public/animations` |
| `d3` | Projection/geo utilities | destination globe | Canvas orthographic globe; cobe is not installed |
| `@supabase/ssr`, `@supabase/supabase-js` | Auth/data/RPC | `src/lib`, admin, route handlers | Browser key is public; RLS is mandatory |
| `katex` | Mathematical typesetting | global CSS/math content | CSS imported globally |

## Preservation Policy

Keep this index, `docs/OWNER_COMPONENT_RUNTIME_AUDIT.md`, `docs/SAGE_GARDEN_REMIX_THEME.md`, and `design-system/oriens-academy` when changing UI. Unknown URLs/licenses are deliberately marked rather than guessed. Any future source URL, author, license header or restoration command should be added here in the same change that imports the component.
