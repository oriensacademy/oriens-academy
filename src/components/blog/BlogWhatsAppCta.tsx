import { FaWhatsapp } from "react-icons/fa6";
import { CONTACT } from "@/config/contact";

/**
 * Premium, low-key WhatsApp CTA shown under every published article (spec
 * §20-23): no plain-text phone number, no bright WhatsApp-green block --
 * a subtle sage card that matches the rest of the Oriens editorial design
 * language, with a single wa.me deep link prefilled with the article title
 * and URL.
 */
export function BlogWhatsAppCta({ title, url, locale }: { title: string; url: string; locale: "tr" | "en" }) {
  const isTr = locale === "tr";
  const message = isTr
    ? `Merhaba Oriens Academy,\n"${title}" başlıklı yazınız hakkında bilgi almak istiyorum.\n\n${url}`
    : `Hello Oriens Academy,\nI would like to get more information about your article "${title}".\n\n${url}`;
  const href = `${CONTACT.whatsappHref}?text=${encodeURIComponent(message)}`;

  return (
    <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-[#DDE4DC] bg-[#F3F6F2] p-6 sm:flex-row sm:items-center sm:justify-between clear-both">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#25D366] shadow-xs">
          <FaWhatsapp className="size-5" />
        </span>
        <div>
          <p className="font-heading text-lg text-[#10271B]">
            {isTr ? "Bu içerikle ilgili bilgi almak ister misiniz?" : "Have questions about this article?"}
          </p>
          <p className="mt-1 text-sm text-[#10271B]/70">
            {isTr
              ? "Sorularınız için Oriens Academy ekibine WhatsApp üzerinden ulaşabilirsiniz."
              : "Contact the Oriens Academy team via WhatsApp."}
          </p>
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#10271B] px-5 text-sm font-semibold text-white transition hover:bg-[#0D2A1C]"
      >
        <FaWhatsapp className="size-4" />
        {isTr ? "WhatsApp'tan Mesaj Gönder" : "Message Us on WhatsApp"}
      </a>
    </div>
  );
}
