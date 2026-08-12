export const pricingPackages = [
  {
    id: "foundation",
    slug: "foundation",
    priceAmount: 90,
    currency: "EUR",
    billingBasis: "session",
    featured: false,
    active: true,
    order: 1,
  },
  {
    id: "method",
    slug: "method",
    priceAmount: 320,
    currency: "EUR",
    billingBasis: "month",
    featured: true,
    active: true,
    order: 2,
  },
  {
    id: "immersive",
    slug: "immersive",
    priceAmount: null,
    currency: "EUR",
    billingBasis: "custom",
    featured: false,
    active: true,
    order: 3,
  },
] as const;

export type PricingPackage = (typeof pricingPackages)[number];
export type PricingPackageId = PricingPackage["id"];
export type PricingBillingBasis = PricingPackage["billingBasis"];

export type PricingContent = {
  metadata: { title: string; description: string };
  breadcrumb: { ariaLabel: string; home: string; current: string };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    indexLabel: string;
  };
  packages: {
    eyebrow: string;
    title: string;
    intro: string;
    featuredLabel: string;
    activeLabel: string;
    priceSourceNote: string;
    customPrice: string;
    billingLabels: Record<PricingBillingBasis, string>;
    formatStartingPrice: (amount: number) => string;
    ctaLabel: string;
    items: Record<PricingPackageId, {
      title: string;
      description: string;
      features: string[];
    }>;
  };
  included: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<{ title: string; description: string }>;
  };
  explanation: {
    eyebrow: string;
    title: string;
    intro: string;
    steps: Array<{ id: string; title: string; description: string }>;
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
