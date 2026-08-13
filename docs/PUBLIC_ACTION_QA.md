# Oriens Academy — Public Action QA Matrix

| PAGE | ELEMENT | TEXT | EXPECTED TARGET | ACTUAL RESULT | PASS/FAIL |
| --- | --- | --- | --- | --- | --- |
| **Header** | Brand Logo | Oriens Academy Logo | `/{locale}` Homepage | Navigates to localized homepage | PASS |
| **Header** | Nav Link | Sınavlar / Exams | `/{locale}/sinavlar` | Navigates to Exams Hub page | PASS |
| **Header** | Nav Link | Üniversite Desteği / University Support | `/{locale}/universite-destegi` | Navigates to University Support page | PASS |
| **Header** | Nav Link | Ücretler / Pricing | `/{locale}/ucretler` | Navigates to Pricing page | PASS |
| **Header** | Nav Link | Hakkımızda / About | `/{locale}/hakkimizda` | Navigates to About page | PASS |
| **Header** | Search Button | Ara / Search (GooeySearchBar) | Opens search popup | Expands search bar with rotating exam placeholders | PASS |
| **Header** | Search Result Link | SAT / IB / AP / etc. | `/{locale}/sinavlar/{slug}` | Navigates to exam detail route without full reload | PASS |
| **Header** | Language Switch | TR / EN | Toggles language | Switches `/tr` <-> `/en` preserving current page route | PASS |
| **Header** | Primary CTA | Ücretsiz Görüşme Planla | `/{locale}#booking` | Scrolls smoothly to booking section | PASS |
| **Hero** | Primary CTA | Ücretsiz Tanışma Görüşmesi | `/{locale}#booking` | Scrolls smoothly to booking section | PASS |
| **Hero** | Secondary CTA | Sınavları İncele | `/{locale}/sinavlar` | Navigates to Exams Hub page | PASS |
| **Hero** | Phone Prev Control | Left Arrow `[ ← ]` | Slide 3 -> Slide 2 -> Slide 1 | Cycles phone carousel backward & resets autoplay | PASS |
| **Hero** | Phone Next Control | Right Arrow `[ → ]` | Slide 1 -> Slide 2 -> Slide 3 | Cycles phone carousel forward & resets autoplay | PASS |
| **Hero** | Phone Dots | Dot 1, 2, 3 | Active slide indicator | Selects target slide and updates active pill (22x7px) | PASS |
| **Global Exams** | Exam Selection Chips | IB, SAT, AP, ESAT, etc. | Focus D3 Globe & update university list | Rotates globe and displays verified university pins | PASS |
| **Global Exams** | University Source Link | Kaynak / Source | Official University Admissions Page | Opens official admissions URL in new tab | PASS |
| **Student Questions** | Question Badges | Marketing Badges | Select concern chip | Displays tailored guidance response | PASS |
| **Student Questions** | Section CTA | Görüşme Planla | `/{locale}#booking` | Scrolls smoothly to booking section | PASS |
| **Pricing** | Package CTA | Görüşme Planla | `/{locale}#booking` | Navigates to booking section | PASS |
| **Consultation CTA** | Floating Popup | Görüşme Planla | `/{locale}/randevu` | Navigates to booking page | PASS |
| **Consultation CTA** | Dismiss Button | Close X / Şimdi Değil | Close popup & set sessionStorage | Hides popup for current session | PASS |
| **Social Dock** | Instagram Link | Instagram Icon | `https://instagram.com/oriensacademy` | Opens Instagram in new tab | PASS |
| **Social Dock** | WhatsApp Link | WhatsApp Icon | `https://wa.me/...` | Opens WhatsApp in new tab | PASS |
| **Social Dock** | Mail Link | Mail Icon | `mailto:info@oriens-academy.com` | Opens mail client | PASS |
| **Footer** | Footer Logo | Oriens Academy Logo | `/{locale}` Homepage | Navigates to localized homepage | PASS |
| **Footer** | Footer Nav Links | Navigation Items | Respective page routes | Navigates cleanly with zero dead links | PASS |
| **Footer** | Footer Email Link | `info@oriens-academy.com` | `mailto:info@oriens-academy.com` | Opens default mail client | PASS |
| **Assessment** | Submit Button | Ön Değerlendirme Talebi Gönder | Insert to `contact_requests` DB | Submits assessment and shows success message | PASS |
