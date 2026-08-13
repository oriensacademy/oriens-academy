"use client";

import Link from "next/link";
import { useLocale } from "@/content/locale-context";
import { localizedPath } from "@/lib/routes";
import { Reveal } from "@/components/motion/Reveal";
import { AssessmentForm } from "./AssessmentForm";
import { ShieldCheck } from "lucide-react";

export function AssessmentPage() {
  const locale = useLocale();
  const isTr = locale === "tr";

  return (
    <>
      <section className="relative overflow-hidden border-b border-border pt-24 pb-16 md:pt-30 md:pb-24">
        <div className="relative mx-auto max-w-[1280px] px-6 md:px-12">
          <nav aria-label={isTr ? "Ekmek kırıntısı" : "Breadcrumb"}>
            <ol className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-muted-foreground font-sans">
              <li>
                <Link href={localizedPath("home", locale)} className="hover:text-foreground">
                  {isTr ? "Ana Sayfa" : "Home"}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-medium text-foreground">
                {isTr ? "Ön Değerlendirme" : "Academic Assessment"}
              </li>
            </ol>
          </nav>

          <div className="mt-8 max-w-3xl">
            <Reveal y={10}>
              <p className="text-xs font-medium tracking-[0.24em] text-primary uppercase font-ui">
                {isTr ? "Akademik Profil & Seviye" : "Academic Profile & Level"}
              </p>
              <h1 className="mt-4 font-heading text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[1.04] tracking-[-0.025em] text-ink">
                {isTr ? "Ön Değerlendirme Formu" : "Academic Assessment Request"}
              </h1>
              <p className="mt-6 text-base md:text-lg leading-relaxed text-muted-foreground font-sans max-w-2xl">
                {isTr
                  ? "Öğrencinin hedeflediği sınav, mevcut seviyesi ve üniversite hedeflerini paylaşın. Size özel çalışma planını birlikte oluşturalım."
                  : "Share your target exam, current academic level and university goals. Let us structure a personalized study plan for you."}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section-offset py-16 md:py-24 bg-surface">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <AssessmentForm />

          <div className="mt-12 text-center max-w-lg mx-auto text-xs text-muted-foreground flex items-center justify-center gap-2 font-sans">
            <ShieldCheck className="size-4 text-primary shrink-0" />
            <span>
              {isTr
                ? "Bilgileriniz Gizlilik Politikamız kapsamında korunur ve üçüncü taraflarla paylaşılmaz."
                : "Your information is protected under our Privacy Policy and never shared with third parties."}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

export default AssessmentPage;
