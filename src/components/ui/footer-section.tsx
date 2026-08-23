import type { ReactNode } from "react";

export function FooterSection({
  brand,
  navigation,
  contact,
  info,
  legal,
}: {
  brand: ReactNode;
  navigation: ReactNode;
  contact: ReactNode;
  info: ReactNode;
  legal: ReactNode;
}) {
  return (
    <footer id="footer" data-owner-component="arihantcodes_1f7b8c4d/footer-section" className="relative border-t border-border bg-background text-foreground">
      <div className="mx-auto max-w-[1280px] px-6 py-6 md:px-10 md:py-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="flex flex-col justify-start">{brand}</div>
          <div>{navigation}</div>
          <div>{contact}</div>
          <div>{info}</div>
        </div>
        <div className="mt-6 border-t border-border pt-4">{legal}</div>
      </div>
    </footer>
  );
}

export default FooterSection;

