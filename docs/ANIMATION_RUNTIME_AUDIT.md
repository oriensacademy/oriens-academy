# Animation Runtime Audit

Audited in a real local Chromium runtime on 2026-08-13. All assets returned HTTP 200, rendered to canvas, and preserved their reserved aspect ratio without horizontal overflow.

| File | Route | Component | Visible | Autoplay | Loop | Offscreen pause | Mobile | Status |
|---|---|---|---|---|---|---|---|---|
| `public/animations/learning.lottie` | `/tr`, `/en`; `/tr/universite-destegi`, `/en/university-support` | `OriensLottie` in StudentJourney and UniversitySupportPage | Yes | Yes while visible | Yes | Yes | Verified at 390/430 | Integrated |
| `public/animations/exams-preparation.lottie` | `/tr/sinavlar`, `/en/exams` | `OriensLottie` in ExamHub | Yes | Yes while visible | Yes | Yes; frame hash remained unchanged offscreen | Verified at 360 | Integrated |
| `public/animations/green-calculator.lottie` | TMUA and OMPT detail routes | `OriensLottie` via exam visual mapping | Yes | Yes while visible | Yes | Yes | TMUA verified at 390 | Integrated only in quantitative context |
| `public/animations/science.lottie` | ESAT detail routes | `OriensLottie` via exam visual mapping | Yes | Yes while visible | Yes | Yes | Verified at 430 | Integrated in science/engineering context |
| `public/animations/erlenmeyer-flask.lottie` | IMAT detail routes | `OriensLottie` via exam visual mapping | Yes | Yes while visible | Yes | Yes | Verified at 390 and desktop | Integrated in chemistry/science context |

## Runtime behavior

- The shared `OriensLottie` implementation uses IntersectionObserver, pauses when the document is hidden, honors `prefers-reduced-motion`, and reserves aspect ratio before playback.
- Browser frame-hash tests confirmed animation while visible, pause while offscreen, and a static frame under reduced motion.
- No playback controls are exposed.
