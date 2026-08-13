export function JsonLd() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "Oriens Academy",
    "url": "https://oriens-academy.com",
    "logo": "https://oriens-academy.com/logo.png",
    "description": "International Exam Preparation & Academic Consultancy for IB, SAT, and AP Diplomas.",
    "sameAs": [],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Oriens Academy",
    "url": "https://oriens-academy.com",
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
