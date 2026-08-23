import type { ReactNode } from "react";

export function FooterSection({
  brand,
  navigation,
  contact,
  address,
  language,
  legal,
}: {
  brand: ReactNode;
  navigation: ReactNode;
  contact: ReactNode;
  address?: ReactNode;
  language: ReactNode;
  legal: ReactNode;
}) {
  return (
    <footer id="footer" data-owner-component="arihantcodes_1f7b8c4d/footer-section" className="relative border-t border-border bg-background text-foreground">
      <div className="mx-auto max-w-[1280px] px-6 py-8 md:px-12 md:py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="flex flex-col justify-between space-y-4">{brand}</div>
          <div>{navigation}</div>
          <div>{contact}</div>
          <div className="flex flex-col gap-6">
            {address}
            {language}
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-4">{legal}</div>
      </div>
    </footer>
  );
}

export default FooterSection;

