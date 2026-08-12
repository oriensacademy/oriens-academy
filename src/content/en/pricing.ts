import type { PricingContent } from "../pricing";

export const pricing = {
  metadata: {
    title: "Pricing | Oriens Academy",
    description: "Explore starting prices and verified package scopes for Oriens Academy individual lessons, exam preparation and comprehensive academic support.",
  },
  breadcrumb: { ariaLabel: "Breadcrumb", home: "Home", current: "Pricing" },
  hero: {
    eyebrow: "Pricing",
    title: "Academic support deserves clear scope and clear pricing.",
    description: "Compare the current starting prices and verified package scope. A precise proposal based on the student's actual needs follows the free initial consultation.",
    primaryCta: "Explore Packages",
    secondaryCta: "Book a Consultation",
    indexLabel: "3 active support routes",
  },
  packages: {
    eyebrow: "Packages",
    title: "From single-subject focus to a complete academic route.",
    intro: "These are academic support scopes, not subscription tiers. Starting figures come directly from existing Oriens project content.",
    featuredLabel: "Most Chosen",
    activeLabel: "Active package",
    priceSourceNote: "Figures shown are starting points. Precise scope and pricing are established after the initial assessment.",
    customPrice: "Custom Proposal",
    billingLabels: { session: "/ session", month: "/ month", custom: "Based on scope" },
    formatStartingPrice: (amount) => `From €${amount}`,
    ctaLabel: "Discuss This Package",
    items: {
      foundation: {
        title: "Foundation",
        description: "For focused, single-subject preparation.",
        features: ["Weekly 1:1 sessions", "Full diagnostic assessment", "Progress reporting"],
      },
      method: {
        title: "Method",
        description: "A comprehensive, multi-subject exam preparation programme.",
        features: ["Everything in Foundation", "Full Oriens Method mapping", "Bi-weekly mock exams", "Direct instructor access"],
      },
      immersive: {
        title: "Immersive",
        description: "Comprehensive support through the university admissions process.",
        features: ["Everything in Method", "University application guidance", "Interview preparation", "Dedicated case manager"],
      },
    },
  },
  included: {
    eyebrow: "Understanding scope",
    title: "What is included should remain visible.",
    intro: "The elements below explain support already present in project content; not every element is automatically included in every package.",
    items: [
      { title: "Individual academic work", description: "Foundation establishes weekly 1:1 sessions; the other packages build on a wider programme scope." },
      { title: "Assessment and planning", description: "The programme begins with a full assessment and a study route shaped around the student's needs." },
      { title: "Progress review", description: "Foundation identifies progress reporting; Method adds programme mapping and regular mock-exam work." },
      { title: "Application support", description: "University application and interview preparation are identified only within Immersive." },
    ],
  },
  explanation: {
    eyebrow: "A transparent process",
    title: "The right scope becomes clear after a short assessment.",
    intro: "Package choice reflects the goal, current level and required support—not lesson count alone.",
    steps: [
      { id: "conversation", title: "Free initial consultation", description: "We discuss the student's goal, current position and area of support." },
      { id: "assessment", title: "Define the scope", description: "We distinguish between single-subject work, multi-subject preparation and application support." },
      { id: "proposal", title: "Clear proposal", description: "The appropriate package, working rhythm and exact price are shared after the consultation." },
    ],
  },
  faq: {
    eyebrow: "Frequently asked questions",
    title: "About pricing.",
    items: [
      { question: "Are the displayed figures final prices?", answer: "The existing Oriens content defines €90 per session and €320 per month as starting figures. A precise proposal follows an assessment of the student's needs." },
      { question: "How do I know which package to choose?", answer: "Single-subject work, multi-subject exam preparation and university application support require different scopes. The initial consultation is designed to establish the appropriate one." },
      { question: "Why does Immersive not have a fixed price?", answer: "Existing project content defines it as a custom proposal. Application guidance, interview preparation and dedicated case management are considered against the student's needs." },
      { question: "Is the initial consultation free?", answer: "Yes. Existing Oriens content describes the initial 30-minute consultation as free and without obligation." },
    ],
  },
  cta: {
    eyebrow: "Talk before deciding",
    title: "Not sure which package is right for you?",
    body: "We can discuss your goal and academic support needs, then establish the right scope together.",
    primary: "Book a Consultation",
    secondary: "Get in Touch",
  },
} satisfies PricingContent;
