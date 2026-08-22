import type { ReactNode } from "react";

export function FooterSection({
  brand,
  navigation,
  contact,
  security,
  language,
  legal,
}: {
  brand: ReactNode;
  navigation: ReactNode;
  contact: ReactNode;
  security: ReactNode;
  language: ReactNode;
  legal: ReactNode;
}) {
  return (
    <footer id="footer" data-owner-component="arihantcodes_1f7b8c4d/footer-section" className="relative border-t border-border bg-background text-foreground">
      <div className="mx-auto max-w-[1280px] px-6 pt-12 pb-10 md:px-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.05fr_.65fr_1.05fr_.95fr_auto]">
          <div className="relative max-w-xs">{brand}</div>
          <div>{navigation}</div>
          <div>{contact}</div>
          <div>{security}</div>
          <div>{language}</div>
        </div>
        <div className="mt-8 border-t border-border pt-5">{legal}</div>
      </div>
    </footer>
  );
}

export default FooterSection;
