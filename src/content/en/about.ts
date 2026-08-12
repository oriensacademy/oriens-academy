import type { AboutContent } from "../about";

export const about: AboutContent = {
  metadata: {
    title: "About | Oriens Academy",
    description: "Discover Oriens Academy's approach to individual needs analysis, academic direction and regular progress review.",
  },
  breadcrumb: { ariaLabel: "Breadcrumb", home: "Home", current: "About" },
  hero: {
    eyebrow: "About Oriens Academy",
    title: "Every academic goal begins by finding the right direction.",
    description: "Oriens does not force a student, an exam or a university course into a fixed template. We clarify the need, make the study route visible and review the process at regular points.",
    primaryCta: "Book a Consultation",
    secondaryCta: "Explore Our Approach",
    visualLabel: "A guidance route from the student to an academic goal",
    visualSteps: ["Student", "Direction", "Academic route", "Goal"],
  },
  story: {
    eyebrow: "Our approach",
    title: "Not a ready-made prescription, but a study system that starts from the student's current position.",
    paragraphs: [
      "Two students preparing for the same exam or taking the same course may need very different support. The process therefore begins by understanding the student's goal, current level, available time and points of difficulty.",
      "The academic route connects concept review, subject-focused work, problem-solving practice and progress review. Priorities can be reset when needed; the aim is to make study clearer and more manageable.",
    ],
    note: "This approach is derived from the existing Oriens framework used across exam preparation, university support and individual academic guidance content.",
  },
  principles: {
    eyebrow: "Principles",
    title: "Five academic principles that establish direction.",
    intro: "Each principle describes a practical decision already represented in the current service journey.",
    items: [
      { id: "direction", title: "Direction", description: "The goal, current position and priorities are clarified before study begins." },
      { id: "individualisation", title: "Individualisation", description: "The plan follows the student's needs and academic calendar rather than a generic template." },
      { id: "clarity", title: "Clarity", description: "Concepts, relationships and solution steps are placed in a coherent structure before memorisation." },
      { id: "review", title: "Review", description: "Errors and progress are reviewed regularly, with priorities adjusted when the route changes." },
      { id: "integrity", title: "Academic integrity", description: "Support is designed to strengthen independent work, not to produce academic work on a student's behalf." },
    ],
  },
  team: {
    eyebrow: "Human support",
    title: "The guidance and teaching structure works around the student's needs.",
    intro: "The human side of individual support is listening to the student, defining the academic need accurately and maintaining clear feedback throughout the work.",
    members: [],
    fallbackTitle: "The working relationship comes before the profile",
    fallbackBody: "The support relationship begins by defining the need together. Concept focus and study priorities are clarified, then progress is reviewed at regular points. Human guidance is therefore connected to the student's actual academic agenda rather than generic advice.",
    fallbackPoints: ["Define the need together", "Set the concept and question focus", "Review progress regularly"],
  },
  brandMoment: {
    eyebrow: "The Oriens direction",
    title: "The compass represents direction, not the answer.",
    body: "The student brings the starting point; guidance makes the direction and academic route visible. Progress toward the destination is shaped by the student's active participation.",
    steps: ["Student", "Direction", "Academic route", "Goal"],
  },
  outcomes: {
    eyebrow: "Areas of development",
    title: "Academic habits the process aims to strengthen.",
    intro: "Because no verified numerical outcomes have been published, this section uses no rates or counters. It instead names the qualitative areas the support is designed to develop.",
    metrics: [],
    items: [
      { title: "Concept mastery", description: "Aim to build a firmer understanding of core concepts and the relationships between them." },
      { title: "Problem-solving discipline", description: "Develop the habit of analysing a problem, selecting a method and checking the result." },
      { title: "Planned study", description: "Turn course content and upcoming assessments into manageable priorities." },
      { title: "Assessment readiness", description: "Address gaps through controlled review and practice before quizzes, exams, midterms or finals." },
      { title: "Academic independence", description: "Support students in making more informed decisions about their own learning." },
    ],
    disclaimer: "These are not guaranteed outcomes; they are areas that individual academic support is intended to develop.",
  },
  trust: {
    eyebrow: "Verifiable scope",
    title: "Trust begins with a clear system, not an impressive number.",
    intro: "The service scope and user journeys currently supported by verified project content:",
    examLabel: "Current exam catalogue",
    links: [
      { route: "exams", title: "International exam preparation", description: "Exams published in the central content model, each with its own preparation page.", linkLabel: "Explore exams" },
      { route: "universitySupport", title: "University academic support", description: "Support with course understanding, concept review, problem solving and study planning.", linkLabel: "Explore university support" },
      { route: "pricing", title: "Transparent pricing", description: "Published package scopes, prices and ways of working.", linkLabel: "Explore pricing" },
    ],
  },
  testimonials: { eyebrow: "Student experience", title: "Verified experiences", items: [] },
  cta: {
    eyebrow: "A first point of direction",
    title: "Let's clarify your academic goal together.",
    body: "We can discuss your needs, current level and academic calendar, then identify an appropriate route for support.",
    primary: "Book a Consultation",
    secondary: "Get in Touch",
  },
};
