import type { Locale } from "./dictionaries";

export type AboutTeamMember = {
  id: string;
  name: string;
  role: string;
  shortBio: string;
  education?: string[];
  subjects?: string[];
  photo?: { src: string; alt: string; width: number; height: number };
  active: boolean;
  order: number;
};

export type AboutResultMetric = {
  id: string;
  value: string;
  label: string;
  source: string;
  active: boolean;
  order: number;
};

export type AboutTestimonial = {
  id: string;
  quote: string;
  name: string;
  context: string;
  exam?: string;
  locale: Locale;
  featured: boolean;
  order: number;
  active: boolean;
  verified: boolean;
};

export type AboutContent = {
  metadata: { title: string; description: string };
  breadcrumb: { ariaLabel: string; home: string; current: string };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    visualLabel: string;
    visualSteps: string[];
  };
  story: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    note: string;
  };
  principles: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<{ id: string; title: string; description: string }>;
  };
  team: {
    eyebrow: string;
    title: string;
    intro: string;
    members: AboutTeamMember[];
    fallbackTitle: string;
    fallbackBody: string;
    fallbackPoints: string[];
  };
  brandMoment: {
    eyebrow: string;
    title: string;
    body: string;
    steps: string[];
  };
  outcomes: {
    eyebrow: string;
    title: string;
    intro: string;
    metrics: AboutResultMetric[];
    items: Array<{ title: string; description: string }>;
    disclaimer: string;
  };
  trust: {
    eyebrow: string;
    title: string;
    intro: string;
    examLabel: string;
    links: Array<{ route: "exams" | "universitySupport" | "pricing"; title: string; description: string; linkLabel: string }>;
  };
  testimonials: {
    eyebrow: string;
    title: string;
    items: AboutTestimonial[];
  };
  cta: {
    eyebrow: string;
    title: string;
    body: string;
    primary: string;
    secondary: string;
  };
};
