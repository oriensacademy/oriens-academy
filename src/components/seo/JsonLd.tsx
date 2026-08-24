import { SITE_URL } from "@/lib/routes";

export function JsonLd() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "Oriens Academy",
    "url": SITE_URL,
    "logo": `${SITE_URL}/logo.png`,
    "description": "International Exam Preparation & Academic Consultancy for IB, SAT, and AP Diplomas.",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Emaar Square, The Heights E Blok, Ünalan Mah., Libadiye Cd. No:82",
      "addressLocality": "Üsküdar",
      "addressRegion": "İstanbul",
      "addressCountry": "TR",
    },
    "sameAs": [],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Oriens Academy",
    "url": SITE_URL,
    "inLanguage": ["tr", "en"],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema),
        }}
      />
    </>
  );
}
