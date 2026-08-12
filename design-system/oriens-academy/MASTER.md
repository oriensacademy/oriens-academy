# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Oriens Academy
**Generated:** 2026-08-11 15:43:36
**Revised:** 2026-08-11 (human-directed brand revision — see Revision Note)
**Category:** Premium Academic / International Education Consultancy

---

## Revision Note

The first auto-generated pass of this file (via `ui-ux-pro-max --design-system`) defaulted to **Liquid Glass** styling and a **Horizontal Scroll Journey** page pattern. Both were evaluated and **rejected** — they read as generic premium-SaaS/e-commerce, not academic consultancy, and directly violate the brand brief (no glassmorphism, no horizontal scroll as a navigation pattern). The tool's own data was instead used as an *analysis engine*: color/typography/style domains were queried multiple times with academic/editorial/Swiss-grid keywords, and the results below are a deliberate synthesis, not a raw tool dump. See the end-of-task report for the full accept/reject rationale.

**Brand concept driving every decision below: NAVIGATION × MATHEMATICS × ACADEMIA.**

---

## 1. Brand Concept

Oriens Academy is a premium international education consultancy: exam preparation, private tutoring, university course support, and study-abroad guidance for high school students, university students, international-exam candidates, and their parents.

The name *Oriens* (Latin, "the rising sun" / "the east" / "point of origin") anchors the brand in **direction, orientation, and rigor** — a student finding their bearing toward a specific academic destination. Two visual metaphors carry this meaning through every surface:

- **The compass** — navigation, guidance, a fixed point of reference, quiet confidence. Used structurally (loader, mark, dividers), never as generic decoration.
- **Mathematics** — coordinate systems, vectors, functions, proofs. Used as evidence of academic seriousness, always tied to real content, never as random background texture.

The brand must read as **premium, academic, trustworthy, international, sophisticated, modern, clean, calm** — the visual register of a serious institution, not a startup, not a fashion house, not a school for children.

---

## 2. Design Philosophy

1. **Editorial restraint over decoration.** Sections are separated by typography, spacing, hairlines, and mathematical composition — not colored boxes, not glass cards, not gradients.
2. **Light, warm, premium-academic base.** Off-white paper tones, deep ink typography, one controlled gold/bronze accent. No dark-mode-as-default, no neon, no glow.
3. **Vertical, classical scroll.** The site is read top to bottom like a well-typeset document. Horizontal scroll is never the primary navigation pattern.
4. **Motion with meaning.** Every animation either draws a mathematical idea, reveals content on entry, or confirms an interaction. Nothing moves just to move.
5. **Static-export performance discipline.** The system must render beautifully on a static Next.js export on ordinary hosting — SVG/CSS/`transform`/`opacity` first, no WebGL, no heavy canvas, no video backgrounds.
6. **Bilingual by construction.** Every component tolerates Turkish strings running 20–40% longer than their English equivalents without breaking.

---

## 3. Color System

**Direction taken:** the auto-generated "Luxury/Premium Brand" palette (`#1C1917` / `#A16207` / `#FAFAF9`) was the *closest* of the tool's suggestions, but its ink was pure warm-black with no navigation identity, and its `--color-muted` (`#E8ECF0`, cool blue-gray) clashed with the warm paper background. The palette below keeps the validated warm-neutral base and validated gold/bronze accent (already WCAG-adjusted by the tool from `#CA8A04`), but replaces the ink with a **charcoal-navy** that literally embodies "dark charcoal or very dark navy typography" from the brief, and introduces a **compass-navy** secondary that ties the mathematical/navigation visual language directly into the semantic color system instead of leaving it purely decorative.

| Role | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Ink (primary text/headings) | `#14181F` | `--color-ink` | All headings, primary body copy |
| Compass Navy (secondary) | `#2B3A55` | `--color-secondary` | Secondary text, nav underlines, math/graph strokes, secondary buttons |
| Accent (gold/bronze) | `#A16207` | `--color-accent` | Primary CTA fill, links, highlights, compass needle |
| Accent Foreground | `#FFFFFF` | `--color-accent-foreground` | Text/icons on accent fill |
| Background (paper) | `#FAF9F6` | `--color-background` | Page background |
| Surface (card) | `#FFFFFF` | `--color-surface` | Cards, elevated panels, inputs |
| Surface Muted (alt section) | `#F4F2ED` | `--color-surface-muted` | Alternate section background for rhythm |
| Border | `#E4E1D9` | `--color-border` | Hairlines, card borders, dividers |
| Muted Foreground | `#6B6558` | `--color-muted-foreground` | Captions, meta text, timestamps |
| Destructive | `#B42318` | `--color-destructive` | Form errors only |
| Ring (focus) | `#14181F` | `--color-ring` | Default focus ring; use `--color-accent` for focus on accent-fill buttons |

**Verified contrast ratios** (WCAG 2.1, computed against `#FAF9F6` background unless noted):

| Pair | Ratio | Level |
|------|-------|-------|
| `--color-ink` on `--color-background` | 16.9:1 | AAA |
| `--color-secondary` on `--color-background` | 10.9:1 | AAA |
| `--color-accent` on `--color-background` | 4.7:1 | AA (normal text) |
| `--color-accent-foreground` on `--color-accent` | 4.9:1 | AA (normal text) |
| `--color-muted-foreground` on `--color-background` | 5.5:1 | AA |

**Rule:** the accent is load-bearing for CTAs, links, and the compass needle — and it *does* pass AA for normal text — but per the brief's "very controlled premium accent," never use it for large fills (no gold backgrounds behind body copy, no gold section blocks). One accent color, used with intent, everywhere.

**Rejected:** the tool's default `--design-system` run for this brief proposed `#EC4899` (pink) as accent under a generic "Editorial" preset — discarded immediately as tonally wrong for an academic brand.

---

## 4. Typography

**Direction taken:** the tool's default heading font, **Playfair Display**, was rejected. It is a high-contrast luxury-fashion display serif (its own dataset lists it under "Luxury brands, fashion, spa, beauty, editorial") — exactly the "lüks moda markası" look the brief prohibits. Querying the typography domain for academic/editorial pairings surfaced **Newsreader** (designed by Production Type for Google News; variable `opsz` + `wght` axes tuned for serious long-form and display reading) as a far better fit: it reads as intelligent and editorial without any fashion connotation, and its optical-size axis means the same family works from hero-scale headlines down to small credential labels.

- **Heading Font:** **Newsreader** (variable, `opsz` 6–72, `wght` 200–800, italic supported)
- **Body Font:** **Inter** (variable, `wght` 300–700) — kept from the original pass; excellent legibility, full Turkish/Latin-Extended coverage, ubiquitous and battle-tested for UI text.
- **Numerals/Stats:** Inter `font-variant-numeric: tabular-nums` for stat counters, prices, and dates so digits don't shift width on update.
- **Mood:** academic, editorial, contemporary, calm authority — explicitly *not* luxury-fashion, *not* corporate-generic.

**Alternates considered, not selected:** Source Serif 4 and Lora (both solid academic serifs, kept in reserve if Newsreader's "newspaper" character ever feels too journalistic for a specific page) — do not swap without updating this file.

**Google Fonts URL:**
```
https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&display=swap
```

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&display=swap');
```

### Type Scale & Hierarchy

| Token | Size (desktop) | Size (mobile) | Font | Weight | Line-height | Usage |
|-------|-----------------|----------------|------|--------|-------------|-------|
| `--text-display` | 64–80px (clamp) | 36–44px | Newsreader | 500, `opsz` auto | 1.05 | Hero headline only |
| `--text-h1` | 48px | 32px | Newsreader | 500 | 1.1 | Page/section H1 |
| `--text-h2` | 36px | 28px | Newsreader | 500 | 1.15 | Section headings |
| `--text-h3` | 24px | 20px | Newsreader | 500 | 1.25 | Card/subsection titles |
| `--text-h4` | 18px | 17px | Inter | 600 | 1.3 | Small headings, labels |
| `--text-body-lg` | 18px | 17px | Inter | 400 | 1.65 | Lead paragraphs |
| `--text-body` | 16px | 16px | Inter | 400 | 1.6 | Default body copy |
| `--text-small` | 14px | 14px | Inter | 400 | 1.5 | Captions, helper text |
| `--text-micro` | 12px | 12px | Inter | 500, uppercase, tracked | 1.4 | Eyebrows, tags, meta labels |

**Rules:** body text never below 16px; line length capped at 65–75 characters desktop, 35–60 mobile; letter-spacing stays at default tracking on body text (only `--text-micro` eyebrows get positive tracking, ~0.06em).

---

## 5. Spacing

4px base unit, extended with two large tokens beyond the original scale to support the brief's "bol whitespace" (generous whitespace) requirement for a premium academic layout.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Tight gaps, icon-to-label |
| `--space-sm` | 8px | Inline spacing, chip padding |
| `--space-md` | 16px | Standard component padding |
| `--space-lg` | 24px | Card padding, form field gaps |
| `--space-xl` | 32px | Component group spacing |
| `--space-2xl` | 48px | Sub-section spacing |
| `--space-3xl` | 64px | Section internal spacing (mobile section padding) |
| `--space-4xl` | 96px | Desktop section vertical padding |
| `--space-5xl` | 128px | Hero vertical padding, major section breaks |

---

## 6. Grid & Layout

- **Grid:** 12-column, `--grid-gap: 24px` desktop / `16px` mobile.
- **Container:** `max-width: 1280px`, centered, `padding-inline: 24px` mobile / `48px` desktop.
- **Content measure:** body copy blocks capped at `65ch` regardless of container width.
- **Section rhythm:** alternate `--color-background` and `--color-surface-muted` between adjacent sections at most every other section — never two consecutive sections in the same alt tone, never more than one visually "boxed" section in a row.
- **No decorative card wrapping of entire sections.** Cards are for discrete items (pricing tiers, testimonials, instructor bios) — never a full-width container around a whole section.

---

## 7. Border Radius

Kept deliberately modest — the brief explicitly forbids "aşırı büyük rounded card tasarımı" (oversized rounded cards). Radius should read as precise/drafted, not soft/bubbly.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | 0px | Hairline dividers, table cells |
| `--radius-sm` | 4px | Tags, badges, small chips |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 10px | Cards, panels |
| `--radius-xl` | 12px | Modals, large media frames (max radius on the site) |
| `--radius-pill` | 9999px | Pills only (nav pills, status chips) — not for buttons/cards |

**Hard rule:** nothing above `12px` radius anywhere. No `rounded-2xl`/`rounded-3xl` blob cards.

---

## 8. Shadows

Depth comes primarily from **borders + whitespace**, in keeping with the Swiss/editorial direction — shadows are a secondary, restrained cue, never a blurred "liquid glass" glow.

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-none` | `none` | Default resting state for most cards (border does the work) |
| `--shadow-sm` | `0 1px 2px rgba(20,24,31,0.05)` | Buttons, chips |
| `--shadow-md` | `0 4px 12px rgba(20,24,31,0.08)` | Card hover, dropdowns |
| `--shadow-lg` | `0 12px 32px rgba(20,24,31,0.12)` | Modals, popovers |

**Forbidden:** `backdrop-filter: blur()` on any surface for decorative purposes; colored/iridescent shadows; shadow used as the sole depth cue on cards (pair with a 1px `--color-border` always).

---

## 9. Iconography

- **Primary set:** **Lucide** (`lucide-react`) — thin, consistent stroke (1.5–1.75px), wide coverage, and the default icon language of shadcn/ui, which this project will later use.
- **Fallback set:** **Phosphor** (`@phosphor-icons/react`, `Regular` weight) only when Lucide lacks a semantically correct icon — never mix styles within the same view.
- **Sizes:** tokens `--icon-sm: 16px`, `--icon-md: 20px`, `--icon-lg: 24px`, `--icon-xl: 32px`.
- **No emoji as icons**, ever, including in Turkish copy where emoji-as-bullet is a common local pattern — use SVG icons.
- Icons are for **UI affordances only** (nav, buttons, form states, feature bullets). Mathematical and compass artwork is hand-built SVG (see §10–11), never sourced from an icon library.

---

## 10. Compass Visual Language

The compass is Oriens' primary brand mark and recurring structural motif — not a one-off hero illustration.

**Construction rules:**
- Always **line-drawn** (geometric strokes, 1.5–2px), never filled/solid unless used at favicon scale.
- Two-color max per instance: `--color-ink` or `--color-secondary` for the frame/rose, `--color-accent` for the needle only.
- Cardinal ticks (N/E/S/W) may appear as minimal tick marks, not full compass-face illustration, in most contexts — the full rose is reserved for the loader and the wordmark lockup.

**Where it appears:**
1. **Logo mark** — abstracted compass rose or needle, works at favicon size (16px) down to monochrome line form.
2. **Loader** — full sequence, see §13.
3. **Section dividers** (used sparingly, 1–2 per page max) — a subtle rotated tick mark or short needle-line replacing a decorative box between two sections, e.g. between "Exam Preparation" and "Oriens Method."
4. **Hover/interaction accent** — on select CTAs, a small compass needle icon may rotate 8–12° toward the direction of travel on hover (subtle, ≤300ms, respects reduced-motion).
5. **Footer mark** — small monochrome compass beside the wordmark.

**Never:** a literal spinning-compass gimmick on every page, a compass as generic "loading spinner" substitute outside the dedicated loader, or compass artwork colored outside the ink/secondary/accent trio.

---

## 11. Mathematical Visual Language

Mathematics is the brand's proof of academic seriousness — it must always be **tied to nearby content**, never dropped in as ambient decoration.

**Component vocabulary** (build as reusable SVG + Motion components):

| Component | Ties to content about... |
|-----------|---------------------------|
| `CoordinateSystem` | General "precision," "method," page backgrounds behind hero copy |
| `AnimatedParabola` | Quadratics, exam prep (SAT/AP/IB math), "Oriens Method" |
| `FunctionPlot` | Data-driven results, "track your progress" |
| `VectorAnimation` | Direction/navigation copy — "find your path," university placement |
| `SineWave` | Rhythm/consistency messaging — study routines, progress over time |
| `TangentAnimation` | Precision/instant-feedback messaging |
| `EquationReveal` | Credential/subject callouts (e.g. calculus, physics) |
| `MathBackground` | Ambient hero backdrop only — always subordinate to headline, low opacity/contrast |

**Rules:**
- **Maximum 1–2 concurrently animated math elements per viewport.** More than that reads as noise, not rigor.
- Rendered in **SVG + CSS + Motion** only — no Three.js/WebGL, no canvas-based plotting libraries.
- Stroke palette limited to `--color-ink`, `--color-secondary`, `--color-accent` — same trio as the compass system, so math and compass motifs read as one coherent visual language, not two competing ones.
- Line weight 1.5–2px, consistent with icon stroke weight (§9) for cross-system cohesion.
- Every math SVG carries an `aria-label` or adjacent visually-hidden text describing the concept (e.g. "Animated graph of a parabola, representing quadratic functions") — see §20.
- Hero's mathematical visual is **interactive but optional** — it must degrade gracefully to a static SVG if JS fails or `prefers-reduced-motion` is set.

---

## 12. Motion System

Values below are anchored to the brief's targets and cross-checked against `ui-ux-pro-max`'s validated GSAP timing data (used as a **timing/easing reference only** — the project itself should use a lighter runtime; see the performance rejection note below).

| Motion type | Duration | Easing | Notes |
|-------------|----------|--------|-------|
| Hover / micro-feedback | 150–300ms | `ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`) | Buttons, links, card border shifts |
| Micro-interaction | 200–400ms | `ease-out` | Form focus, toggle states |
| Content reveal (fade/slide) | 400–700ms | `power2.out`-equivalent (`cubic-bezier(0.22, 1, 0.36, 1)`) | Scroll-triggered section entrances |
| Hero sequence | 600–1000ms total | staged, `ease-out` | Headline → subhead → CTA → visual, sequential not simultaneous |
| List/grid stagger | 30–50ms per item | `ease-out` | Cap total stagger under ~8 items; beyond that, batch-fade instead |
| SVG path draw (math/compass) | 600–1200ms | `linear` on `stroke-dashoffset`, eased on opacity | Draws once on first viewport entry, does not replay on every scroll pass |

**Allowed:** subtle fade/reveal, text reveal (word/line level, not excessive per-character splitting), stagger, SVG path drawing, coordinate/graph animation, equation reveal, number counters (tabular-nums), image reveal (clip-path wipe), subtle parallax (≤1 section pinned, ≤20% travel), card hover (border-color + 2–4px translateY, never scale beyond 1.02), compass needle rotation, route/line drawing.

**Forbidden:** bounce/spring overshoot on informational UI, glow/blur pulsing, randomly floating decorative objects, aggressive 3D/parallax layering, scroll-hijacking beyond one deliberate pinned moment (if any), horizontal-scroll-driven storytelling, animations that never stop (idle looping motion on static content).

**`prefers-reduced-motion` is mandatory**: all entrance animations collapse to instant opacity swaps; the compass loader and any SVG path-draw skip straight to their end state.

**Runtime note (performance-driven rejection):** do not adopt GSAP + `SplitText` for the character-stagger effect the tool's own data recommends — `SplitText` is a paid GSAP Club plugin, an unnecessary dependency and licensing cost for a static-export marketing site. Use the **Motion** library (motion.dev, formerly Framer Motion) for all of the above; its `variants`/`stagger` API covers word- and line-level stagger without a paid plugin, and it tree-shakes better for this project's performance budget (§23).

---

## 13. Loader System

A custom compass-loading sequence — **SVG + Motion, never a GIF or raster asset.**

**Sequence:**
1. Compass outline / geometric frame lines draw in (`stroke-dashoffset`, ~300–400ms).
2. Needle appears and rotates through 1–2 sweeping arcs (~400–500ms), suggesting "searching."
3. Needle settles and locks toward north/the accent color (~200–300ms), slight overshoot-then-settle (≤5°) is the *one* place a spring-like ease is acceptable, kept small.
4. "ORIENS" wordmark fades/tracks in beneath the settled compass (~200ms).
5. Whole loader cross-fades out to reveal the page (~250–300ms).

**Constraints:**
- Total sequence target: **800–1400ms**. This is a brand moment, not a blocking wait — if the page is ready before the sequence completes, do not artificially extend it.
- Skip entirely (or collapse to a ~150ms cross-fade) on repeat visits within a session and whenever `prefers-reduced-motion` is set.
- Never block interaction longer than necessary; loader is cosmetic, not a real loading-state indicator — if actual asset loading takes longer, the loader should not lie about progress (no fake progress bar).

---

## 14. Buttons

```css
/* Primary CTA — accent fill */
.btn-primary {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
  padding: 12px 24px;
  min-height: 44px;
  border-radius: var(--radius-md);
  font: 600 16px/1 Inter, sans-serif;
  transition: background-color 200ms ease-out, transform 200ms ease-out;
  cursor: pointer;
}
.btn-primary:hover {
  background: #8A5406; /* darkened accent, contrast re-verified ≥4.5:1 */
  transform: translateY(-1px);
}
.btn-primary:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Secondary — ink outline */
.btn-secondary {
  background: transparent;
  color: var(--color-ink);
  border: 1.5px solid var(--color-ink);
  padding: 12px 24px;
  min-height: 44px;
  border-radius: var(--radius-md);
  font: 600 16px/1 Inter, sans-serif;
  transition: background-color 200ms ease-out, border-color 200ms ease-out;
  cursor: pointer;
}
.btn-secondary:hover {
  background: var(--color-surface-muted);
}

/* Tertiary — text link, editorial feel */
.btn-tertiary {
  background: none;
  border: none;
  color: var(--color-ink);
  font: 500 16px/1 Inter, sans-serif;
  padding: 4px 0;
  text-decoration: underline;
  text-decoration-color: var(--color-border);
  text-underline-offset: 4px;
  transition: text-decoration-color 200ms ease-out;
  cursor: pointer;
}
.btn-tertiary:hover {
  text-decoration-color: var(--color-accent);
}
```

**Rule:** one primary CTA per screen/viewport; secondary/tertiary actions are always visually subordinate. No pill-shaped buttons for primary/secondary actions (pills reserved for tags/filters, §7).

---

## 15. Cards

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-none);
  transition: border-color 200ms ease-out, box-shadow 200ms ease-out, transform 200ms ease-out;
}
.card:hover {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

No `backdrop-filter`, no scale-on-hover beyond 1.02, no gradient overlays. A card's only hover cues are border-color, a light shadow, and a small lift — legible, calm, premium.

---

## 16. Forms

```css
.input {
  padding: 12px 16px;
  min-height: 44px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font: 400 16px/1.4 Inter, sans-serif; /* 16px min to avoid iOS auto-zoom */
  color: var(--color-ink);
  transition: border-color 200ms ease-out, box-shadow 200ms ease-out;
}
.input:focus-visible {
  border-color: var(--color-ink);
  outline: none;
  box-shadow: 0 0 0 3px rgba(20, 24, 31, 0.12);
}
.input.error {
  border-color: var(--color-destructive);
}
.input-label {
  display: block;
  font: 500 14px/1.4 Inter, sans-serif;
  color: var(--color-ink);
  margin-bottom: 6px;
}
.input-error-text {
  font: 400 13px/1.4 Inter, sans-serif;
  color: var(--color-destructive);
  margin-top: 6px;
}
```

**Rules:** visible labels always (no placeholder-only labels); errors render directly below their field with icon + text (never color alone); validate on blur, not per keystroke; booking/consultation forms auto-save drafts for long multi-step flows.

---

## 17. Navigation

- **Desktop:** sticky top nav, transparent over the hero, transitions to `--color-surface` + `1px --color-border` bottom edge after ~80px scroll (200ms transition).
- **Lockup:** compass mark + "ORIENS ACADEMY" wordmark, left-aligned.
- **Primary items:** Programs / Exam Prep / University Support / Method / Results / Pricing — kept to what fits without wrapping in either language; overflow items move to a "More" menu rather than shrinking type.
- **CTA:** one accent-filled "Book a Consultation" button, always present in the nav, right-aligned.
- **Language switcher (TR/EN):** compact, icon+label, next to the CTA — never buried in a footer-only location.
- **Mobile:** full-screen overlay menu (not a narrow slide-in drawer) — large tap targets (≥44px), same section order as desktop, CTA repeated at the top of the overlay.
- **Active state:** current section indicated by a thin `--color-accent` underline, not a filled pill.
- Current navigation location is always visually distinguishable; no relying on color alone (weight change accompanies the accent underline).

---

## 18. Section Design

Sections are separated by **typography, spacing, hairlines, and mathematical composition** — never by wrapping a whole section in a colored/rounded box.

- Vertical rhythm: `--space-4xl` (96px) between sections desktop, `--space-3xl` (64px) mobile.
- Alternate `--color-background` / `--color-surface-muted` at most every other section (§6).
- At most **1–2 sections** per page use a subtle mathematical/compass motif as a literal divider (a drawn line, not a box).
- Section headings follow a consistent eyebrow → H2 → lead-paragraph pattern: `--text-micro` accent-colored eyebrow, `--text-h2` Newsreader heading, `--text-body-lg` Inter lead line.
- Section order for the homepage (as specified in the brief): Navbar → Hero + interactive mathematics → Trust/results indicators → Exam preparation → Oriens Method → Interactive mathematics section → University support → Why Oriens → Instructor/about → Results/testimonials → Pricing preview → Booking CTA → FAQ → compact footer.

---

## 19. Responsive Rules

**Breakpoints:** `375px`, `768px`, `1024px`, `1440px`, `1920px`.

- **Mobile-first**, not "shrink the desktop layout." The hero specifically recomposes: on mobile, the mathematical visual either moves below the headline/CTA stack or becomes a lightweight, lower-contrast background element — it never competes with the primary message for the first viewport.
- **Bilingual resilience:** never fix widths to English string lengths. Buttons, nav items, and badges use `min-width` + horizontal padding, not fixed `width`. Test every component with both the English and the (typically 20–40% longer) Turkish string before shipping.
- No horizontal scroll anywhere on mobile (outside of an explicitly intentional, clearly-affordanced carousel — e.g. testimonials — which must show a partial next-card peek as a visible affordance, not rely on a hidden gesture).
- Touch targets minimum 44×44px, 8px+ spacing between adjacent targets.
- Use `min-height: 100dvh` over `100vh` for any full-viewport section on mobile.

---

## 20. Accessibility

- **Contrast:** WCAG AA minimum everywhere (AAA achieved for ink/secondary text per §3's verified ratios); never rely on the tool's raw suggestion without re-verifying against the actual background it's used on.
- **Focus states:** visible 2px ring with 2px offset on every interactive element (`--color-ring`); never remove focus outlines without a compliant replacement.
- **Keyboard navigation:** full tab-order support matching visual order; skip-to-main-content link; no keyboard traps in the mobile overlay menu or any modal.
- **Semantic HTML:** proper landmark regions (`header`, `nav`, `main`, `footer`), sequential heading hierarchy (no skipped levels), `label for=` on every form field.
- **Reduced motion:** `prefers-reduced-motion` disables/shortens all entrance animation, the loader sequence, and SVG path-drawing (§12–13).
- **Math/compass SVGs:** every decorative-but-meaningful SVG carries an `aria-label` (or adjacent `sr-only` text) describing the concept it represents — screen reader users should understand *what* the parabola or vector means, not just that "an image is present."
- **Language:** correct `lang="tr"`/`lang="en"` attribute and `hreflang` tags per locale route.
- **Color is never the sole indicator** of state (errors, active nav, required fields all pair color with icon/text/weight).
- **Minimum usable touch targets:** 44×44px, consistent with §19.

---

## 21. Performance Rules

Target: **static Next.js export on ordinary web hosting** — no server runtime to lean on, so the design system must be render-cheap by default.

**Avoid:**
- WebGL / Three.js for any of the mathematical or compass visuals (§10–11) — SVG + CSS + Motion only.
- Large video backgrounds anywhere, hero included.
- Heavy `<canvas>`-based plotting — SVG paths are sufficient for every listed math component.
- Excessive JS-driven animation — prefer CSS transitions for simple hover/focus states; reserve the Motion library for orchestrated sequences (hero, loader, scroll reveals).
- Heavy dependencies: no GSAP Club plugins (see §12 rejection note), no large charting libraries for what are fundamentally illustrative (not data-driven) graphs.

**Prefer:**
- SVG for all illustrative math/compass artwork, optimized (SVGO) and inlined where small.
- CSS custom properties for every token in this file — no ad-hoc hex values in components.
- `transform`/`opacity` for all animated properties (never animate `width`/`height`/`top`/`left`).
- Font subsetting to `latin` + `latin-ext` (covers Turkish characters) for both Newsreader and Inter, self-hosted with `font-display: swap`.
- Code-splitting/dynamic import for below-the-fold math components so they never block the hero's first paint.
- WebP/AVIF for any photographic assets (instructor photos, etc.), with explicit `width`/`height` or `aspect-ratio` to prevent CLS.

---

## 22. Do / Don't

### Do
- Vertical scrolling, classical and confident.
- Warm off-white background, deep charcoal-navy ink, one controlled gold/bronze accent.
- Newsreader for headings, Inter for body — editorial and academic, not fashion.
- Mathematical visuals tied to the content beside them, max 1–2 concurrent per viewport.
- Compass motif used structurally (loader, mark, sparing dividers), always line-drawn.
- Generous whitespace; section separation via typography/spacing/hairlines.
- Subtle, purposeful motion within the documented duration/easing ranges.
- `prefers-reduced-motion` support everywhere, always.

### Don't
- ❌ **Liquid Glass / heavy glassmorphism** — no `backdrop-filter` blur as a decorative surface treatment.
- ❌ **Horizontal Scroll Journey as primary navigation** — vertical scroll only.
- ❌ Generic SaaS landing-page tropes (gradient mesh heroes, floating dashboard mockups).
- ❌ Cheap/template-feeling visuals; no stock "smiling students at laptop" hero photography as the lead visual.
- ❌ Neon tech-site aesthetics, glow effects anywhere.
- ❌ Oversized gradients.
- ❌ Oversized rounded cards (radius capped at 12px, §7).
- ❌ Childish/playful school-site visual language (no cartoon mascots, no primary-color blocks).
- ❌ Unnecessary 3D.
- ❌ Continuously animating/looping decorative elements.
- ❌ Playfair Display, or any comparably fashion-coded display serif, for headings.
- ❌ Emoji as icons or bullets.
- ❌ Fixed-width components that break under longer Turkish strings.

---

## 23. External Component Rules

The project will later use **shadcn/ui**, selected **21st.dev** components, and **Motion**. None of these may be dropped in unmodified.

- **shadcn/ui:** override the default theme CSS variables to this file's tokens (§3, §7, §8) at the root — the out-of-the-box zinc palette, default `rounded-2xl`/`rounded-3xl` radii, and default `shadow-lg` elevation must all be replaced, not layered on top of.
- **21st.dev components:** frequently ship with built-in glassmorphism, gradient flourishes, or oversized rounded corners for visual appeal — these must be stripped/restyled to match §7–§8 before use. Treat every imported component as a behavior/structure donor, not a visual-style donor.
- **Icons in third-party components:** re-map to Lucide (§9) if the component ships its own icon set, to keep one consistent stroke language.
- **Motion in third-party components:** re-time any built-in animation to this file's duration/easing table (§12) rather than accepting the component's defaults.
- **Focus states:** any third-party component's default focus ring must be re-mapped to `--color-ring` (§20) — never ship a component with a mismatched default outline color.

---

## 24. Final Visual QA Checklist

Before delivering any UI code, verify:

**Brand fidelity**
- [ ] No `backdrop-filter` blur used decoratively anywhere (Liquid Glass fully absent)
- [ ] No horizontal-scroll-driven navigation or storytelling pattern
- [ ] No Playfair Display or other fashion-coded display serif in use
- [ ] Compass motif present but restrained (loader + mark + ≤2 sparing dividers, not on every section)
- [ ] Every mathematical visual is tied to adjacent content, not randomly placed; ≤2 concurrent animated math elements per viewport
- [ ] No stock "students at laptop" photography used as a lead visual
- [ ] Border radius ≤12px everywhere; no oversized rounded cards

**Accessibility**
- [ ] Light mode text contrast verified against actual background (4.5:1 body, 3:1 large text minimum)
- [ ] Focus states visible for keyboard navigation on every interactive element
- [ ] `prefers-reduced-motion` respected — loader, scroll reveals, SVG path-draws all degrade gracefully
- [ ] Math/compass SVGs carry `aria-label` or `sr-only` description text
- [ ] Color never the sole indicator of state
- [ ] Semantic HTML landmarks and sequential heading hierarchy in place

**Responsive / bilingual**
- [ ] Verified at 375 / 768 / 1024 / 1440 / 1920
- [ ] Verified with both Turkish and English copy — no truncation, no broken fixed-width components
- [ ] Mobile hero is a genuine recomposition, not a shrunk desktop copy
- [ ] No horizontal scroll on mobile outside an intentionally-affordanced carousel
- [ ] Touch targets ≥44×44px with adequate spacing

**Interaction & performance**
- [ ] `cursor: pointer` on all clickable elements
- [ ] Hover/transition timing within the §12 duration table
- [ ] No content hidden behind the sticky navbar
- [ ] No WebGL/canvas/video-background used for math or compass visuals
- [ ] Below-the-fold math components code-split/dynamically imported
- [ ] Compass loader completes within the 800–1400ms target and is skippable on repeat visits
