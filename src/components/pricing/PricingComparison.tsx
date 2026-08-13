import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComparisonPackage = {
  id: string;
  title: string;
  description: string;
  discount?: string | null;
  unitPrice?: string;
  originalPrice?: string;
  totalPrice?: string;
  badge?: string;
};

export function PricingComparison({
  packages,
  locale,
  bookingHref,
}: {
  packages: ComparisonPackage[];
  locale: "tr" | "en";
  bookingHref: string;
}) {
  const labels = locale === "tr"
    ? { package: "Paket", discount: "İndirim Oranı", unit: "Birim Ücret", total: "Toplam", unitLesson: "Birim ders", cta: "Görüşme Planla" }
    : { package: "Package", discount: "Discount", unit: "Unit Price", total: "Total", unitLesson: "Per lesson", cta: "Book a Consultation" };

  return <>
    <div className="hidden overflow-hidden rounded-[24px] border border-[#CBD5CC] bg-[#FAF8F2] shadow-[0_20px_55px_rgba(16,39,27,0.08)] md:block">
      <table className="w-full table-fixed border-collapse text-left font-ui">
        <thead className="bg-[#11271F] text-white">
          <tr className="text-[11px] uppercase tracking-[0.12em] lg:text-xs">
            <th className="w-[40%] px-5 py-5 lg:px-7">{labels.package}</th>
            <th className="w-[18%] px-4 py-5">{labels.discount}</th>
            <th className="w-[19%] px-4 py-5">{labels.unit}</th>
            <th className="w-[23%] px-4 py-5 lg:px-6">{labels.total}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#DDE3DB]">
          {packages.map((item) => <tr key={item.id} className={cn(
            "bg-[#FBF9F3] transition-colors hover:bg-white",
            item.id === "package10" && "bg-[#F8F1DF]",
            item.id === "package30" && "bg-[#EAF0E8]",
          )}>
            <td className="px-5 py-6 lg:px-7">
              {item.badge && <span className="mb-2 inline-flex rounded-full border border-[#B99D59]/35 bg-white/70 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[#765F27]">{item.badge}</span>}
              <div className="font-heading text-xl text-[#10281E] lg:text-2xl">{item.title}</div>
              <div className="mt-1 text-xs leading-relaxed text-[#667269] lg:text-sm">{item.description}</div>
            </td>
            <td className="px-4 py-6 text-base font-bold text-[#52675B]">{item.discount ?? "—"}</td>
            <td className="px-4 py-6 text-base font-semibold tabular-nums text-[#10281E] lg:text-lg">{item.unitPrice}</td>
            <td className="px-4 py-6 lg:px-6">
              {item.originalPrice && <div className="text-xs tabular-nums text-[#7A847E] line-through lg:text-sm">{item.originalPrice}</div>}
              <div className="mt-1 text-xl font-bold tabular-nums text-[#10281E] lg:text-2xl">{item.totalPrice}</div>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>

    <div className="grid gap-4 md:hidden">
      {packages.map((item) => <article key={item.id} className={cn(
        "rounded-[22px] border border-[#D6DED5] bg-[#FBF9F3] p-5 shadow-[0_10px_30px_rgba(16,39,27,0.06)]",
        item.id === "package10" && "border-[#CBB77C] bg-[#F8F1DF]",
        item.id === "package30" && "border-[#9CAF9E] bg-[#EAF0E8]",
      )}>
        {item.badge && <span className="inline-flex rounded-full bg-[#10281E] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white">{item.badge}</span>}
        <h3 className="mt-3 font-heading text-2xl text-[#10281E]">{item.title}</h3>
        <p className="mt-1 text-sm text-[#667269]">{item.description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 border-y border-[#CBD5CC] py-4">
          <div><div className="text-[10px] uppercase tracking-wider text-[#6B776F]">{labels.discount}</div><div className="mt-1 text-lg font-bold text-[#52675B]">{item.discount ?? "—"}</div></div>
          <div><div className="text-[10px] uppercase tracking-wider text-[#6B776F]">{labels.unitLesson}</div><div className="mt-1 text-lg font-bold tabular-nums text-[#10281E]">{item.unitPrice}</div></div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>{item.originalPrice && <div className="text-sm tabular-nums text-[#7A847E] line-through">{item.originalPrice}</div>}<div className="text-2xl font-bold tabular-nums text-[#10281E]">{item.totalPrice}</div></div>
          <Link href={bookingHref} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#10281E] px-4 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#819586] focus-visible:ring-offset-2">{labels.cta}<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
        </div>
      </article>)}
    </div>
  </>;
}
