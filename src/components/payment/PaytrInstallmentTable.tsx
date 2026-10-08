"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { kurusToDecimalString } from "@/lib/payments/pricing";
import { buildPaytrInstallmentTableUrl, paytrInstallmentTableEnv } from "@/lib/payments/paytr-installment-table";

// PayTR taksit tablosu (panel > Taksit Tablosu entegrasyonu). Banka / taksit /
// vade farkı tutarları yalnız PayTR'nin betiğinden gelir; burada hesaplanmaz ve
// betiğin yazdığı içerik değiştirilmez. Tablo bilgilendirme amaçlıdır: yüklenemezse
// ödeme formu ve token akışı aynen çalışır.
export const paytrInstallmentTableEnabled = Boolean(paytrInstallmentTableEnv.merchantId && paytrInstallmentTableEnv.installmentToken);

const TABLE_ID = "paytr_taksit_tablosu";
const LOAD_TIMEOUT_MS = 15_000;

// PayTR panelindeki resmi tablo stili (renk / yazı / hücre düzeni). Kartlar
// kapsayıcı genişliğine göre en fazla 2 sütuna dizilir; dar ekranda tek sütun.
const TABLE_CSS = `
#${TABLE_ID}{display:grid;grid-template-columns:repeat(auto-fill,minmax(max(240px,calc((100% - 8px) / 2)),1fr));gap:8px;font-size:12px;text-align:center;font-family:Arial,sans-serif;}
#${TABLE_ID} .taksit-tablosu-wrapper{min-width:0;padding:12px;cursor:default;border:1px solid #e1e1e1;background:#fff;}
#${TABLE_ID} .taksit-logo img{max-height:28px;max-width:100%;padding-bottom:10px;margin:0 auto;}
#${TABLE_ID} .taksit-baslik,#${TABLE_ID} .taksit-tutar-wrapper{display:flow-root;}
#${TABLE_ID} .taksit-tutari-text{float:left;width:50%;color:#a2a2a2;margin-bottom:5px;}
#${TABLE_ID} .taksit-tutar-wrapper{background-color:#f7f7f7;}
#${TABLE_ID} .taksit-tutar-wrapper:hover{background-color:#e8e8e8;}
#${TABLE_ID} .taksit-tutari{float:left;width:50%;box-sizing:border-box;padding:6px 0;color:#474747;border:2px solid #fff;}
#${TABLE_ID} .taksit-tutari-bold{font-weight:bold;}
`;

// PayTR betiği `document.getElementById('paytr_taksit_tablosu').innerHTML = …`
// çalıştırır. Aynı anda tek betik yüklenir: tutar değişince (ör. kupon teklifi
// geldiğinde) eski tutarın geç yanıtı yeni tabloyu ezemez, sayfada iki tablo
// oluşmaz. Sıradaki yükleme, öncekinin load / error / zaman aşımını bekler.
let loadQueue: Promise<void> = Promise.resolve();

type Status = "loading" | "ready" | "failed";

export interface PaytrInstallmentTableProps {
  /** Ödenecek son tutar, tam sayı kuruş (calculateAuthoritativeTotal().finalTotalKurus). */
  amountKurus: number;
  merchantId?: string;
  installmentToken?: string;
  /** 0 = PayTR varsayılanı (panelin verdiği değer). */
  taksit?: number;
  /** 0 = avantajlı seçenekler (panel varsayılanı), 1 = tüm seçenekler. */
  tumu?: 0 | 1;
  /** Tablo yüklenemezse gösterilecek kısa, teknik olmayan not. */
  fallback?: ReactNode;
}

export function PaytrInstallmentTable({
  amountKurus,
  merchantId = paytrInstallmentTableEnv.merchantId,
  installmentToken = paytrInstallmentTableEnv.installmentToken,
  taksit = 0,
  tumu = 0,
  fallback = null,
}: PaytrInstallmentTableProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const src = buildPaytrInstallmentTableUrl({ merchantId, installmentToken, amountKurus, taksit, tumu });
  const [result, setResult] = useState<{ src: string; status: Status } | null>(null);
  const status: Status = result?.src === src ? result.status : "loading";

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !src) return;
    let active = true;
    let inFlight: { target: HTMLElement; release: () => void } | null = null;

    loadQueue = loadQueue.then(
      () =>
        new Promise<void>((done) => {
          if (!active) return done();
          const target = document.createElement("div");
          target.id = TABLE_ID;
          host.replaceChildren(target);
          const script = document.createElement("script");
          script.src = src;
          script.async = true;
          let sink: HTMLElement | null = null;
          const finish = (loaded: boolean) => {
            if (!inFlight) return;
            inFlight = null;
            window.clearTimeout(timer);
            script.onload = script.onerror = null;
            script.remove();
            sink?.remove();
            if (active) setResult({ src, status: loaded && target.childElementCount > 0 ? "ready" : "failed" });
            done();
          };
          // Bileşen betik yüklenirken kalkarsa hedef gizli bir kaba taşınır;
          // betik çalıştığında hedefi bulur (konsol hatası olmaz), sonra kap silinir.
          inFlight = {
            target,
            release: () => {
              sink = document.createElement("div");
              sink.hidden = true;
              sink.append(target);
              document.body.append(sink);
            },
          };
          const timer = window.setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
          script.onload = () => finish(true);
          script.onerror = () => finish(false);
          document.body.append(script);
        })
    );

    return () => {
      active = false;
      if (inFlight) inFlight.release();
      else host.replaceChildren();
    };
  }, [src]);

  if (!src) return null;
  if (status === "failed") return fallback ? <div className="mt-3">{fallback}</div> : null;
  return (
    <>
      <style>{TABLE_CSS}</style>
      <div
        ref={hostRef}
        aria-busy={status === "loading"}
        data-paytr-installment-table={status}
        data-paytr-amount={kurusToDecimalString(amountKurus)}
        className="mt-3 max-h-[26rem] min-h-8 max-w-full overflow-y-auto overflow-x-hidden overscroll-contain"
      />
    </>
  );
}
