# Oriens Academy — Owner Lottie Animation Inventory

Verified locally on 2026-08-13. Each public copy is byte-identical to its owner-supplied Desktop source. All five files are served locally; no animation depends on an external URL.

| FILE | SOURCE | PUBLIC PATH | DIMENSIONS | FPS / DURATION | PURPOSE | PAGE | SECTION | AUTOPLAY | LOOP | MOBILE SIZE | REDUCED MOTION | STATUS |
|---|---|---|---|---|---|---|---|---:|---:|---|---|---|
| `Science.lottie` | `docs/references/owner-assets/Science.lottie` | `/animations/science.lottie` | 512×512 | 30 / 5s | Broad STEM and science preparation | TR/EN ESAT detail | Detail introduction | YES | YES | 194–220px | Paused at frame zero | PASS |
| `learning.lottie` | `docs/references/owner-assets/learning.lottie` | `/animations/learning.lottie` | 750×500 | 24 / 5.71s | Learning process, feedback and support | TR/EN home | How Oriens Works | YES | YES | 312–382px wide, 3:2 ratio | Paused at frame zero | PASS |
| `Green calculator.lottie` | `docs/references/owner-assets/Green calculator.lottie` | `/animations/green-calculator.lottie` | 480×480 | 60 / 2s | Quantitative and mathematical reasoning | TR/EN TMUA and OMPT detail | Detail introduction | YES | YES | 194–220px | Paused at frame zero | PASS |
| `Erlenmeyer flask.lottie` | `docs/references/owner-assets/Erlenmeyer flask.lottie` | `/animations/erlenmeyer-flask.lottie` | 1050×1050 | 60 / 3s | Chemistry and science preparation | TR/EN IMAT detail | Detail introduction | YES | YES | 194–220px | Paused at frame zero | PASS |
| `Exams Preparation..lottie` | `docs/references/owner-assets/Exams Preparation..lottie` | `/animations/exams-preparation.lottie` | 512×512 | 60 / 6s | Main exam-preparation overview | TR/EN Exams hub | Hero | YES | YES | 286–340px | Paused at frame zero | PASS |

## Runtime policy

- Player: `@lottiefiles/dotlottie-react` through the single shared `OriensLottie` wrapper.
- Playback controls are not rendered and canvases are removed from keyboard navigation.
- `IntersectionObserver` starts nearby animations and freezes them once they move offscreen.
- `visibilitychange` pauses/freezes players while the page is hidden and resumes eligible visible players when it returns.
- The wrapper reserves a square or 3:2 aspect ratio before loading and fades the canvas in without layout shift.
- Stable component placement avoids restarting players during incidental local state changes.
- The owner-approved homepage phone remains the hero visual; the learning animation appears farther down the page.

## Browser evidence

- Every canvas was found, rendered non-empty pixels and changed frames while visible.
- The Exams hub canvas produced identical frame hashes after scrolling offscreen, confirming pause/freeze behavior.
- Local asset requests returned HTTP 200 for all five files.
- Tested at 360×800, 390×844, 430×932 and 1440×900 without horizontal overflow or clipping.
