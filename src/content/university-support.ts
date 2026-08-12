export type UniversitySupportAreaCategory =
  | "quantitative"
  | "assessment"
  | "academic-work"
  | "study-systems";

export type UniversitySupportArea = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  category: UniversitySupportAreaCategory;
  topics: string[];
  featured: boolean;
  order: number;
};

export type UniversitySupportStep = {
  id: string;
  title: string;
  description: string;
};

export type UniversitySupportContent = {
  metadata: { title: string; description: string };
  breadcrumb: { ariaLabel: string; home: string; current: string };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    visualLabel: string;
    visualNote: string;
  };
  audience: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<{ title: string; description: string }>;
  };
  areas: {
    eyebrow: string;
    title: string;
    intro: string;
    indexLabel: string;
    categoryLabels: Record<UniversitySupportAreaCategory, string>;
    items: UniversitySupportArea[];
    scopeNote: string;
  };
  method: {
    eyebrow: string;
    title: string;
    intro: string;
    steps: UniversitySupportStep[];
  };
  visual: {
    eyebrow: string;
    title: string;
    description: string;
    caption: string;
    labels: { function: string; tangent: string; point: string };
    ariaLabel: string;
  };
  approach: {
    eyebrow: string;
    title: string;
    items: Array<{ title: string; description: string }>;
  };
  journey: {
    eyebrow: string;
    title: string;
    intro: string;
    steps: UniversitySupportStep[];
  };
  individual: {
    eyebrow: string;
    title: string;
    body: string;
    points: string[];
  };
  faq: {
    eyebrow: string;
    title: string;
    items: Array<{ question: string; answer: string }>;
  };
  cta: {
    eyebrow: string;
    title: string;
    body: string;
    primary: string;
    secondary: string;
  };
};
