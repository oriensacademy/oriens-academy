# Oriens Academy — Design Specification for Google Stitch

> **Source of truth:** `design-system/oriens-academy/MASTER.md`. This file does not introduce, override, or reinterpret any decision made there — it re-expresses the same brand, color, typography, spacing, shape, motion, and content decisions in a format optimized for AI visual-design generation tools (Google Stitch and similar). If anything here ever appears to conflict with MASTER.md, MASTER.md wins and this file is wrong.
>
> **Purpose:** MASTER.md is written for engineers implementing a design system in code (CSS variables, component specs, accessibility rules, performance constraints). DESIGN.md is written for a generative visual design tool that needs to *see* the brand — composition, mood, hierarchy, and visual metaphor — in order to produce genuinely on-brand concepts rather than a generic template with Oriens' colors painted on.

---

## 1. Brand

**Name:** Oriens Academy

**Core Concept:** Navigation × Mathematics × Academia

Oriens (Latin: "the rising sun," "the east," "point of origin") is a premium international education consultancy — exam preparation, private tutoring, university course support, and study-abroad guidance for high school students, university students, international-exam candidates, and their parents.

**What the brand means, visually:**
- Direction
- Guidance
- Compass
- Route
- Academic achievement
- Precision
- International education

**What the brand must feel like on screen:**
- Premium
- Academic
- Sophisticated
- Trustworthy
- International
- Calm
- Modern
- Editorial
- Highly polished

Every generated screen should look like it belongs to an institution a parent would trust with their child's university future — not a product a student would casually download.

---

## 2. Visual Personality

**The site must not look like:**
- A technology startup (no gradient-mesh hero, no floating dashboard mockup, no "Get Started Free" SaaS energy)
- A luxury fashion brand (no lipstick-and-perfume editorial styling, no oversized italic display serif dripping in whitespace for its own sake)
- A school website aimed at children (no mascots, no primary-color blocks, no playful rounded shapes, no clip-art)

**The target aesthetic is a deliberate blend of four things, simultaneously:**

1. **Elite academic consultancy** — the visual confidence of a top-tier admissions/tutoring firm: restrained, credential-forward, unhurried.
2. **Modern editorial design** — the typographic discipline of a well-produced publication: clear hierarchy, generous margins, considered line-breaks.
3. **Mathematical precision** — visible evidence of rigor: coordinate grids, drawn curves, vectors, annotated graphs, used as real brand material, not stock decoration.
4. **Subtle navigation/compass symbolism** — a quiet, recurring sense of direction and orientation, never a literal cartoon compass sticker.

When in doubt, generate toward "a serious institution's website," not "a modern app."

---

## 3. Color Tokens

These are final. **Do not generate new colors, tints, or accent hues.** Every screen must be composable from this exact palette.

| Token | Hex | Purpose | Use on |
|-------|-----|---------|--------|
| `background` | `#FAF9F6` | Page background — warm off-white "paper," never stark white, never gray | The canvas itself; behind all content |
| `surface` | `#FFFFFF` | Card, panel, input, and modal backgrounds — one shade lighter/cleaner than the page so elevated content reads as lifted | Cards, form fields, popovers, the nav bar once scrolled |
| `surface-muted` | `#F4F2ED` | Alternate section background, used to create rhythm between sections without a hard boundary | Every other major section (never two in a row), never on small components |
| `ink` | `#14181F` | Primary text and headings — a deep charcoal-navy, not pure black | All headings, primary body copy, primary buttons' outline/text, default icon color |
| `secondary` / "compass navy" | `#2B3A55` | Secondary text, and the structural color of the navigation/mathematics motif | Secondary text, nav active-state underline, math/graph line strokes, secondary button ink, compass frame/rose |
| `accent` (bronze/gold) | `#A16207` | The single warm highlight color of the whole brand | Primary CTA button fill, links, the compass needle only, small highlight marks — never large fills, never a full section background |
| `accent-foreground` | `#FFFFFF` | Text/icon color when placed on the accent fill | Text inside accent-filled buttons |
| `border` | `#E4E1D9` | Hairline dividers and card edges | 1px borders on cards, inputs, section dividers, table rules |
| `muted-foreground` | `#6B6558` | Tertiary/meta text — quieter than body copy but still warm, not cold gray | Captions, timestamps, form helper text, footnotes |
| `destructive` | `#B42318` | Error state only | Form validation errors — always paired with an icon/text, never color alone |

**How the palette should read as a whole:** warm paper background, near-black charcoal-navy ink for authority, one restrained gold/bronze accent used sparingly and deliberately (like a wax seal, not a highlighter), and a muted navy that quietly carries the "navigation" meaning through text and line-art rather than through a literal icon everywhere. No pure black, no pure white text-on-background, no cool gray anywhere in the palette — everything is warm-neutral except the deliberate navy.

**Absolute rule:** the accent (`#A16207`) is the *only* saturated color on the site. Everything else is ink, navy, or warm neutral. If a generated concept has more than one "loud" color, it is off-brand.

---

## 4. Typography

**Heading font:** Newsreader (serif, variable — optical size axis 6–72, weight 200–800, italic available)
**Body font:** Inter (sans-serif, variable — weight 300–700)

This pairing is deliberately **academic-editorial, not fashion-editorial.** Newsreader was chosen specifically because it was designed for serious long-form reading (Google News), not for luxury branding — it must never be swapped for a high-contrast, exaggerated-thin/thick fashion display serif (e.g. Playfair Display, Didot-style faces). If a generated concept's headline typography starts to feel like a perfume ad, it has drifted off-brand.

### Heading hierarchy

| Level | Font | Character | Typical role |
|-------|------|-----------|---------------|
| **Display** | Newsreader, medium weight, tight line-height (~1.05) | The single largest text on the page | Hero headline only — appears once per page |
| **H1** | Newsreader, medium weight | Large, confident, editorial | Page-level title (used once per page, non-hero pages) |
| **H2** | Newsreader, medium weight | Clear section-opening weight | Every major homepage section title |
| **H3** | Newsreader, medium weight | Noticeably smaller than H2, still serif | Card titles, sub-section titles within a section |
| **H4** | Inter, semibold, sans — a deliberate shift away from serif | Compact, functional | Small in-card headings, feature labels |

### Body hierarchy

| Level | Font | Character | Typical role |
|-------|------|-----------|---------------|
| **Body Large** | Inter, regular, generous line-height (~1.65) | Lead paragraph weight, sits right under an H2 | Section intros, hero supporting copy |
| **Body Normal** | Inter, regular | Standard reading text | Default paragraph copy everywhere |
| **Body Small** | Inter, regular | Quieter, still fully legible | Captions, helper text, fine print |

### Label / eyebrow / navigation

- **Eyebrow labels** (the small tag above a section heading, e.g. "EXAM PREPARATION"): Inter, medium weight, uppercase, slightly letter-spaced, set in the accent color — this is one of the few places the accent color is used as text, and only at small sizes.
- **Navigation items:** Inter, medium weight, regular case (not uppercase) — navigation should feel calm and readable, not shouty.
- **Buttons:** Inter, semibold — never the serif, buttons are always functional/sans.

**Governing rule for all typography generation:** headings are always serif (Newsreader), UI and reading text are always sans (Inter). Never mix — a sans-serif heading over serif body copy is off-brand, and so is an all-serif page (that would read as literary/fashion, not academic-editorial-modern).

---

## 5. Spacing and Layout

The layout language is **editorial**: generous margins, a disciplined grid, and clear alignment — never cramped, never app-dashboard-dense.

- **Scroll direction:** strictly **vertical**. The page is read top to bottom like a well-typeset long-form document. Horizontal scrolling is never the primary layout or navigation pattern anywhere on the site.
- **Grid:** a 12-column editorial grid, generous gutters, centered content container (roughly 1280px max-width on large desktop) with wide outer margins rather than edge-to-edge content.
- **Whitespace:** deliberately generous — large vertical gaps between sections (think "premium consultancy brochure," not "dense SaaS dashboard"). Nothing should feel like it's fighting for space.
- **Section containers:** restrained. A section is defined by *spacing and typography*, not by wrapping it in a colored, shadowed, or heavily rounded box. Avoid the instinct to put every section inside its own rounded card/panel.
- **Alignment:** clean, consistent left-alignment for text blocks within a section; content should feel drafted with a ruler, not eyeballed.
- **Separation between sections:** achieved through generous vertical spacing, occasional **subtle hairline rules** (thin 1px lines in the border color), and — sparingly, once or twice per page — a drawn mathematical or compass line motif standing in for a divider. Never a hard color-block boundary between every section.
- **Rhythm:** alternate the warm off-white background and the slightly warmer muted surface tone between sections at most every other section, to create quiet rhythm without visual noise.

---

## 6. Shape Language

- **Corners are precise, not bubbly.** Radius stays small and consistent across the whole system — buttons and inputs use a modest radius, cards use a slightly larger but still restrained radius, and nothing on the site should ever approach a large "blobby" rounded-corner look.
- **Hard ceiling:** no corner radius anywhere should read as "oversized" — think refined and drafted, closer to a sharp architectural edge softened just enough to feel warm, not a soft bubble or pill.
- **No giant pills.** Pill/fully-rounded shapes are reserved for small elements only (tags, small status chips) — never for buttons, never for cards, never for large containers.
- **No floating bubble layouts.** Avoid compositions where every element sits in its own separate rounded floating card scattered with heavy shadow — that reads as generic app UI, not editorial consultancy.
- **Cards are used with intent, not by default.** Use a card when presenting a genuinely discrete, comparable item (a pricing tier, a testimonial, an instructor's bio, a single result stat). Do not wrap an entire page section in a card just to give it a container — most sections should sit directly on the page background.
- **Borders over shadows.** Where a boundary is needed, a thin 1px hairline border reads more premium/editorial than a soft drop shadow. Shadows exist but are used sparingly (mainly on hover states or true overlays like modals), never as the default resting state for ordinary content.

---

## 7. Compass Visual Language

The compass is one of Oriens' two primary visual systems — but it is a **structural motif, not a sticker.** It should never be scattered across the page as a generic decorative icon.

**What it should carry, semantically:** the meaning of *branding + direction + academic guidance* — a compass in this system always signals "you are being guided toward a destination," never just "here is a nice icon."

**Elements available to draw from:**
- Compass needle (the primary moving/highlighted element — rendered in the accent gold/bronze)
- North marker / cardinal tick marks (N/E/S/W), often reduced to minimal tick lines rather than a full compass face
- Route lines — a single confident directional line suggesting a path or trajectory
- Coordinates — small crosshair or coordinate-point markings
- Orientation marks — subtle registration marks, corner ticks, alignment marks reminiscent of technical drafting or cartography
- Subtle navigation geometry — circles, radii, and angle arcs drawn with the same precision as the mathematical motifs in §8

**Construction style:** always thin, line-drawn geometry (never a filled solid icon, except possibly at favicon scale). Limit each instance to two colors at most: the compass-navy for the frame/rose/lines, and the accent gold/bronze reserved for the needle or a single highlighted point.

**Where it belongs (and where it doesn't):**
- The logo mark / wordmark lockup — an abstracted compass form, simple enough to work tiny.
- The loading sequence (§12) — its one moment of full, dedicated compass artwork.
- A hairline section divider, sparingly (once or twice across the whole homepage) — a tick mark or short needle-line standing in for a decorative separator.
- A restrained hover/interaction detail on select CTAs — never on every button.
- The footer, as a small monochrome mark beside the wordmark.
- **Not** as a repeating background pattern, not as a bullet-point icon, not stamped on every card or section — restraint is what makes it feel premium rather than gimmicky.

---

## 8. Mathematical Visual Language

Mathematics is Oriens' second core visual system — the brand's proof of academic seriousness. It must always feel like it belongs to the content next to it, never like ambient decorative texture.

**Elements available to draw from:**
- Coordinate systems (axes, grid lines)
- Parabolas and other function curves
- Sine waves
- Vectors (arrows with clear direction and magnitude)
- Tangent lines
- Equations (rendered as clean typographic/mathematical notation, not clipart)
- Geometric constructions (angles, circles, triangles used precisely, not decoratively)
- Graph curves plotting a trend or result
- Subtle numerical markers (axis labels, small annotated values)
- Light grid systems as background texture, used at very low contrast

**Governing feeling:** every mathematical element on the page should look like it was drawn by someone who actually understands the mathematics — precise, annotated, purposeful. It should never read as generic "tech/data particle" decoration (no floating random dots, no abstract "AI network" node-graphs, no meaningless swirling lines).

**Discipline rules for generation:**
- Tie every mathematical visual to the content beside it (a parabola belongs near copy about quadratics/exam math; a vector belongs near copy about direction/university placement; a rising graph curve belongs near results/progress copy).
- Keep it restrained: no more than one or two mathematical visual elements active in a single viewport at once. A page dense with graphs everywhere reads as cluttered, not rigorous.
- Use the same three-color discipline as the compass system (ink / compass-navy / accent) so math and compass artwork read as one coherent visual language rather than two competing decorative systems.
- Line weight should be consistent and precise throughout — thin, confident strokes, not sketchy or hand-drawn, not thick and cartoonish.

---

## 9. Hero Direction

**Primary composition for the homepage hero — a clean two-column split:**

**Left column:**
- Eyebrow label (small, accent-colored, uppercase-tracked — e.g. a category tag like "INTERNATIONAL EDUCATION CONSULTANCY")
- Strong editorial headline (Display-level Newsreader serif — confident, a few words, not a paragraph)
- Supporting copy (one short paragraph, Inter, Body Large)
- Primary CTA (accent-filled button)
- Secondary CTA (outline or text-link style, visually subordinate to the primary)

**Right column:**
- A premium mathematical visualization — **not** a stock photograph of students. This is the hero's signature visual asset and should combine, tastefully and without clutter:
  - A coordinate grid (light, precise, low-contrast background structure)
  - One animated/drawn graph curve (a parabola or similar function curve) as the clear focal element
  - A subtle compass reference (a needle, a few cardinal ticks, or a small orientation mark — restrained, not a full illustration)
  - A route/directional line suggesting movement toward a point or destination
  - Light mathematical annotation (a small equation label, an axis tick, a coordinate point) as a credibility detail, not a busy overlay

**Composition discipline:** the hero must read as calm and confident, not crowded. The right-side visual is one considered composition, not five separate decorative elements competing for attention — think "a single elegant diagram," not "a collage." Generous whitespace surrounds both columns; nothing touches the edges of the viewport without intention.

**Explicitly rejected as a default:** any generic stock photograph of smiling students at a laptop/table as the lead hero visual. If photography of real people (instructors, students) is used anywhere on the site, it belongs further down the page (About/Instructor section), never as the hero's primary visual.

---

## 10. Homepage Structure

The homepage follows this section order. Stitch concepts should honor this sequence and the relative weight/purpose of each section — variation in *composition* is welcome, variation in *order or omission* is not.

1. **Navbar** — compass mark + wordmark, primary nav items, language switcher, one accent CTA
2. **Hero + Interactive Mathematics** — see §9
3. **Trust / Results** — credibility indicators (numbers, outcomes, recognitions) presented with editorial restraint, not busy dashboard-style stat tiles
4. **Exam Preparation** — program overview for exam-prep offerings
5. **Oriens Method** — the consultancy's distinctive approach/methodology
6. **Interactive Mathematics Feature** — a dedicated, deeper showcase of the mathematical visual system (more elaborate than the hero's supporting glimpse)
7. **University Support** — course support / university-level offering
8. **Why Oriens** — differentiation section
9. **Instructor / About** — the people behind the academy (this is where real photography, if any, belongs)
10. **Results / Testimonials** — social proof, outcomes, quotes
11. **Pricing Preview** — a restrained glimpse of pricing tiers, not a full comparison table
12. **Booking CTA** — a focused conversion moment (book a consultation)
13. **FAQ** — accordion-style Q&A
14. **Compact Footer** — brief, premium, not a sprawling link directory — wordmark, minimal nav, language switcher, essential legal links

---

## 11. Motion Intent

This section describes **where and how motion should visually read** in a generated concept — not implementation code. Stitch's static frames should imply these motions through composition (e.g., a graph mid-draw, a headline mid-reveal, an element positioned to suggest entry direction) where relevant, and any interactive prototype behavior should stay within this intent.

**Planned animations the visual design should anticipate:**
- Compass loader sequence (see §12)
- Compass needle rotation (a small, deliberate directional gesture, not a spin)
- SVG line drawing (mathematical curves and compass geometry appearing to "draw themselves" on)
- Mathematical graph drawing (a curve tracing into view)
- Equation reveal (typographic fade/reveal of notation)
- Coordinate movement (a point or marker gliding along a defined path)
- Text reveal (headline/paragraph entrance)
- Subtle stagger (list or card items entering in quick, small sequence)
- Number counters (stat values counting up to their final value)
- Subtle hover states (small, controlled feedback on interactive elements)
- Subtle parallax (very light depth-of-field movement on scroll, used sparingly)

**The overall motion feeling is: quiet, precise, purposeful** — like a hand carefully drawing a diagram, not like an app trying to feel exciting.

**Explicitly avoid, in both static composition and any implied motion:**
- Excessive floating (elements that look like they're aimlessly drifting)
- Bouncing (springy, playful overshoot on informational elements)
- Constant movement (anything that reads as perpetually animating/looping on a static page)
- Neon glow (any glow effect at all)
- Aggressive 3D (dramatic depth, tilted 3D card stacks, extruded shapes)
- Excessive blur (heavy background blur, frosted-glass treatments)
- Scroll hijacking (any implication that scrolling is being taken over rather than following the user naturally down the page)

---

## 12. Compass Loader Concept

A dedicated brand moment shown briefly on load — **not a generic spinner.**

**Visual sequence:**
1. Compass geometry appears (thin frame/rose lines drawing themselves in)
2. Needle rotates (a brief, deliberate searching motion — one or two sweeps, not a spin)
3. Needle settles, pointing north, resolving in the accent gold/bronze color
4. "ORIENS" wordmark appears beneath the settled compass
5. The whole composition fades to reveal the page

**Visual direction:** minimal, premium, geometric, academic — this should look like a single elegant technical drawing completing itself, rendered only in the ink/compass-navy/accent palette on the warm paper background. It should feel like the calm, confident opening of a well-made document, not a tech-product boot animation.

**Format constraint:** no GIF, ever. The final implementation will be SVG + Motion (a code-level animation library) — Stitch's role is to define the *visual* target state of each step above, not to produce an animated file itself.

---

## 13. Bilingual Design

The site ships in **Turkish and English.** Every layout must be designed to survive both languages without breaking, since Turkish strings typically run noticeably longer than their English equivalents.

- No text container, button, or navigation item should be designed around a fixed narrow width that only works for short English words — assume labels can grow.
- Buttons should be sized by their content plus padding, not locked to a specific pixel width.
- Navigation should have enough breathing room that a longer Turkish label doesn't force wrapping or truncation; if a concept's nav looks tight in English, it will break in Turkish.
- Headlines and section titles should be composed so that a longer translated version still fits comfortably within the established hierarchy and line-length rules (§5), without needing a smaller font size as a fallback.

Design every text-bearing element as if you do not know which language will render inside it.

---

## 14. Responsive Design

Design coherently across these widths: **375 / 768 / 1024 / 1440 / 1920.**

- **Mobile is not a shrunk desktop layout.** The mobile composition — especially the hero — should be genuinely re-composed: the mathematical visualization simplifies and typically moves below the headline/CTA stack (or becomes a lighter, lower-contrast background element) rather than competing with the primary message in the first viewport.
- **Mathematical visualizations simplify on mobile** — fewer simultaneous elements, lower visual complexity, but the same visual language (same colors, same line weight, same precision) as desktop. Simplification means "less," not "different style."
- Maintain the same editorial restraint, spacing rhythm, and shape language at every breakpoint — generous whitespace should compress proportionally, not disappear.
- Navigation collapses to a full, calm overlay pattern on small screens rather than a cramped condensed bar.

---

## 15. Do Not

Any generated concept containing the following is off-brand and should be discarded or corrected:

- ❌ Liquid Glass / heavy glassmorphism (frosted, blurred, translucent surfaces)
- ❌ Horizontal scroll journey as a primary layout or navigation pattern
- ❌ Neon color or neon glow of any kind
- ❌ Excessive gradients (large, colorful gradient meshes or backgrounds)
- ❌ Giant rounded cards / oversized corner radii
- ❌ Generic SaaS design tropes (gradient-mesh hero, floating dashboard mockup screenshots, "Get Started" startup energy)
- ❌ Childish education design (mascots, primary-color blocks, playground shapes)
- ❌ Excessive blur (background blur, frosted panels, heavy soft-focus)
- ❌ Random floating decorative objects (particles, blobs, abstract shapes with no meaning)
- ❌ Heavy 3D (dramatic extrusion, tilted 3D stacks, deep drop-shadowed depth)
- ❌ Visual clutter (too many competing focal points in one viewport)
- ❌ Giant generic stock photos (especially "smiling students at a laptop" as a lead visual)
- ❌ Excessive gold — the accent is a controlled highlight, never a dominant fill or large color block
- ❌ Luxury fashion aesthetic (high-contrast fashion display serifs, perfume-ad styling, excessive italic flourish)
- ❌ Excessive shadows (heavy, soft, glowing drop shadows as a default styling choice)

---

## 16. Stitch Generation Guidance

When generating concepts from this specification, Stitch (or any equivalent AI visual design tool) should:

- Maintain Oriens brand identity in every concept — the color tokens (§3), typography pairing (§4), and compass/mathematical visual languages (§7–8) are fixed, not creative variables.
- Preserve the typography and color system exactly as specified — explore layout and composition, not new fonts or new hues.
- Explore **composition**, not random brand changes — differentiate concepts through layout, hierarchy, and information architecture, never by substituting the palette, fonts, or core visual motifs.
- Prioritize desktop + mobile coherence — every concept should be considered at both a large desktop viewport and a mobile viewport, not designed desktop-only.
- Use the mathematical visual system as a distinguishing brand asset — lean into it as the site's signature differentiator, not an afterthought decoration.
- Maintain a strong conversion hierarchy — it should always be visually obvious what the primary action is on any given screen (per §10's booking/CTA-focused structure).
- Maintain generous whitespace — when in doubt, add more space rather than more content.
- Create premium but realistic web layouts — everything generated should be plausibly buildable as a real, static, performant website, not an impossible art-directed mockup.
- Avoid impossible decorative UI — no visual element that couldn't reasonably exist in a real, shipped web page.
- Avoid over-designing — restraint is the brand's core visual value; a simpler, calmer composition is almost always more on-brand than a more elaborate one.

**Differentiation requirement:** the three design directions ultimately generated from this specification must be **genuinely different in composition** — different structural approaches to the hero, different information architecture choices, different use of the mathematical/compass motifs — **not simple color or typography variations** of the same underlying layout. If three concepts only differ in accent placement or minor spacing, they do not satisfy this brief.
