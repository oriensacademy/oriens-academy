# Owner Component Runtime Audit

Audited locally on 2026-08-13. “Visible” means the generated owner-selected entry point is mounted in a real route, not merely present on disk.

| Component | Original install command | Generated path | Imported by | Route | Visible | Mobile | Status |
|---|---|---|---|---|---|---|---|
| creative-pricing | `npx shadcn@latest add "https://21st.dev/r/kokonutd/creative-pricing"` | `src/components/ui/creative-pricing.tsx` | `src/components/pricing/PricingPage.tsx` | `/tr/ucretler`, `/en/pricing` | Yes; five live DB packages | 360/390/430 no overflow | Integrated; Oriens DB adapter retains rotation, offset shadow, badges and hover lift |
| text-rotate | `npx @21st-dev/cli add danielpetho/text-rotate` | `src/components/ui/text-rotate.tsx` | `src/components/sections/Hero.tsx` | `/tr`, `/en` | Yes; short exam accent only | Yes | Integrated |
| text-reveal | `npx @21st-dev/cli add cnippet.dev/text-reveal` | `src/components/text-reveal.tsx` | `src/components/sections/Hero.tsx` | `/tr`, `/en` | Yes; main hero heading | Yes | Integrated selectively |
| how-it-works | `npx @21st-dev/cli add chamaac/how-it-works` | `src/components/how-it-works.tsx` | `src/components/sections/StudentJourney.tsx` | `/tr`, `/en` | Yes; five localized process steps | Yes | Integrated with Oriens palette |
| 3d-carousel | `npx shadcn@latest add "https://21st.dev/r/cult-ui/3d-carousel"` | `src/components/ui/3d-carousel.tsx` | `src/components/exams/ExamHub.tsx` | `/tr/sinavlar`, `/en/exams` | Yes; secondary academic gallery | Yes; drag enabled | Integrated without external demo imagery |
| testimonials-section | `npx @21st-dev/cli add sshahaider/testimonials-section` | `src/components/testimonials-section.tsx` | `src/components/sections/ResultsTestimonials.tsx` | `/tr`, `/en` | Yes; four verified DB records per locale | Yes | Integrated; fake random-user defaults removed |
| phone-mockups-1 | `npx @21st-dev/cli add solaceui/phone-mockups-1` | `src/components/ui/phone-mockups-1.tsx` and utility | `src/components/sections/Hero.tsx` | `/tr`, `/en` | Yes; original phone entry point | 360/390/430 no overflow; swipe enabled | Integrated; 4-second autoplay, arrows, dots and owner placeholders |
| counting-number | `npx @21st-dev/cli add cnippet.dev/counting-number` | `src/components/ui/counting-number.tsx` | `src/app/admin/page.tsx` | `/admin` after authentication | Yes; admin operational counts | Admin responsive layout | Integrated only with real DB counts; no public metric invented |
| marketing-badges | `npx @21st-dev/cli add jatin-yadav05/marketing-badges` | `src/components/marketing-badges.tsx` | `src/components/sections/StudentQuestions.tsx` | `/tr`, `/en` | Yes; six student concerns with selected explanation/CTA | 360/390/430 no overflow | Integrated; no marketing-agency vocabulary |
| gradient-card | `npx @21st-dev/cli add ravikatiyar162/gradient-card` | `src/components/gradient-card.tsx` | `src/components/sections/ExamPreparation.tsx` | `/tr`, `/en` | Yes; verified exam groups | 360/390/430 no overflow | Integrated with real Oriens exam content |

## Data integrity notes

- Public pricing is read from `pricing_packages`, not from demo constants.
- Homepage and About testimonials are read from `testimonials`; the local database contains the eight owner-approved TR/EN records already present in the official content files.
- CountingNumber remains admin-only because no suitable public statistic was independently verified.
- The phone uses explicit temporary Oriens placeholders; unrelated Behance, Reddit and similar screenshots are not used.
