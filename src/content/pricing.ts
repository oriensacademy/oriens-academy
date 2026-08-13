export const pricingPackages = [
  {
    id: "single",
    slug: "single",
    priceAmount: 3200,
    currency: "TRY",
    billingBasis: "session",
    featured: false,
    active: true,
    order: 1,
  },
  {
    id: "package5",
    slug: "package5",
    priceAmount: 15000,
    currency: "TRY",
    billingBasis: "month",
    featured: false,
    active: true,
    order: 2,
  },
  {
    id: "package10",
    slug: "package10",
    priceAmount: 27000,
    currency: "TRY",
    billingBasis: "month",
    featured: true,
    active: true,
    order: 3,
  },
  {
    id: "package20",
    slug: "package20",
    priceAmount: 51000,
    currency: "TRY",
    billingBasis: "month",
    featured: false,
    active: true,
    order: 4,
  },
  {
    id: "package30",
    slug: "package30",
    priceAmount: 72000,
    currency: "TRY",
    billingBasis: "month",
    featured: false,
    active: true,
    order: 5,
  },
] as const;

export interface PricingPackage {
  id: string;
  slug?: string;
  priceAmount: number | null;
  currency?: string;
  billingBasis: "session" | "month" | "custom" | string;
  featured: boolean;
  active: boolean;
  order: number;
}
export type PricingPackageId = string;
export type PricingBillingBasis = "session" | "month" | "custom";

export type PricingContentItem = {
  title: string;
  description: string;
  features: string[];
  unitPrice?: string;
  totalPrice?: string;
  originalPrice?: string;
  discount?: string | null;
  badge?: string;
};

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
    formatStartingPrice: (amount: number | string) => string;
    ctaLabel: string;
    items: Record<string, PricingContentItem>;
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
