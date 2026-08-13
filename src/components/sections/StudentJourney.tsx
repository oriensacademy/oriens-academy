"use client";

import { Reveal } from "@/components/motion/Reveal";
import HowItWorks, { type Step, type StepPosition } from "@/components/how-it-works";
import { OriensLottie } from "@/components/ui/OriensLottie";
import { useLocale } from "@/content/locale-context";

const copy = {
  tr: {
    eyebrow: "ORIENS İLE SÜREÇ",
    title: "Hedefinizden sonraki adıma, birlikte ilerleyelim.",
    body: "İlk görüşmeden ders ve geri bildirim sürecine kadar her adımın nedenini ve sırasını bilin.",
    steps: [
      ["Tanışma", "Hedeflerinizi ve mevcut akademik durumunuzu kısa bir ilk görüşmede dinleriz."],
      ["Hedef Analizi", "Ülke, üniversite, bölüm ve sınav hedeflerinizi birlikte netleştiririz."],
      ["Çalışma Planı", "Takviminize ve seviyenize uygun kişisel hazırlık planını oluştururuz."],
      ["Ders & Geri Bildirim", "Dersleri kontrollü pratik ve düzenli geri bildirimle birlikte yürütürüz."],
      ["İlerleme Takibi", "Gelişimi gözden geçirir, ihtiyaç oldukça çalışma planını güncelleriz."],
    ],
  },
  en: {
    eyebrow: "HOW ORIENS WORKS",
    title: "Move from your goal to the next step with a clear route.",
    body: "Understand the purpose and order of each step, from the first conversation to lessons and progress review.",
    steps: [
      ["Introduction", "We listen to your goals and current academic context in a short first consultation."],
      ["Goal Analysis", "We clarify your target country, university, programme and examinations."],
      ["Study Plan", "We build a personal preparation plan around your timeline and starting point."],
      ["Lessons & Feedback", "Lessons run alongside controlled practice and regular feedback."],
      ["Progress Tracking", "We review progress and update the plan when your needs change."],
    ],
  },
} as const;

const palette = [
  { bg: "bg-[#F6F8F3]", text: "text-[#819586]", border: "border-[#D9E3D8]" },
  { bg: "bg-[#E6EDE5]", text: "text-[#10271B]", border: "border-[#C5D1C4]" },
  { bg: "bg-[#F4F1E6]", text: "text-[#9B7B38]", border: "border-[#D6B56D]" },
  { bg: "bg-[#D9E3D8]", text: "text-[#10271B]", border: "border-[#C5D1C4]" },
  { bg: "bg-[#EEF2ED]", text: "text-[#819586]", border: "border-[#D9E3D8]" },
];

const positions: StepPosition[] = [
  { className: "md:absolute md:top-0 md:left-[10%]", rotate: "-rotate-2" },
  { className: "md:absolute md:top-[120px] md:right-[10%]", rotate: "rotate-2" },
  { className: "md:absolute md:top-[430px] md:left-[10%]", rotate: "-rotate-1" },
  { className: "md:absolute md:top-[560px] md:right-[10%]", rotate: "rotate-2" },
  { className: "md:absolute md:top-[850px] md:left-[16%]", rotate: "-rotate-2" },
];

export function StudentJourney() {
  const locale = useLocale();
  const content = copy[locale];
  const features: Step[] = content.steps.map(([title, description], index) => ({ title, description, colors: palette[index] }));

  return (
    <section id="how-it-works" className="section-offset overflow-hidden border-y border-border bg-white py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.72fr)] lg:gap-16">
          <Reveal className="max-w-3xl">
            <p className="text-xs font-bold tracking-[.24em] text-brand-accent uppercase">{content.eyebrow}</p>
            <h2 className="mt-4 font-heading text-[clamp(2rem,4vw,3.6rem)] leading-[1.08] text-ink">{content.title}</h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{content.body}</p>
          </Reveal>
          <Reveal delay={0.08} className="mx-auto w-full max-w-[460px]">
            <OriensLottie src="/animations/learning.lottie" aspectRatio="learning" speed={0.9} ariaLabel={locale === "tr" ? "Kişiselleştirilmiş öğrenme ve akademik destek animasyonu" : "Personalized learning and academic support animation"} />
          </Reveal>
        </div>

        <Reveal delay={0.12} className="mt-8">
          <HowItWorks features={features} stepPositions={positions} className="!bg-transparent !px-0" />
        </Reveal>
      </div>
    </section>
  );
}

export default StudentJourney;
