"use client";

import { useEffect, useRef } from "react";

// PayTR taksit tablosu (panel > Taksit Tablosu entegrasyonu). Panelin verdiği
// tablo anahtarı ve mağaza no herkese açık gömme değerleridir; tanımlı değilse
// tablo hiç yüklenmez. Ödeme / token akışına dokunmaz. Banka / taksit oranları
// yalnız PayTR'nin betiğinden gelir; burada hesaplanmaz.
const TABLE_TOKEN = process.env.NEXT_PUBLIC_PAYTR_INSTALLMENT_TOKEN?.trim() || "";
const MERCHANT_ID = process.env.NEXT_PUBLIC_PAYTR_MERCHANT_ID?.trim() || "";

export const paytrInstallmentTableEnabled = Boolean(TABLE_TOKEN && MERCHANT_ID);

// PayTR panelindeki resmi tablo stili (renk / yazı / hücre düzeni); kartlar
// kapsayıcı genişliğine göre ızgaraya dizilir, böylece dar ekranda taşmaz.
const TABLE_CSS = `
#paytr_taksit_tablosu{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;font-size:12px;text-align:center;font-family:Arial,sans-serif;}
#paytr_taksit_tablosu .taksit-tablosu-wrapper{min-width:0;padding:12px;cursor:default;border:1px solid #e1e1e1;background:#fff;}
#paytr_taksit_tablosu .taksit-logo img{max-height:28px;padding-bottom:10px;margin:0 auto;}
#paytr_taksit_tablosu .taksit-baslik,#paytr_taksit_tablosu .taksit-tutar-wrapper{display:flow-root;}
#paytr_taksit_tablosu .taksit-tutari-text{float:left;width:50%;color:#a2a2a2;margin-bottom:5px;}
#paytr_taksit_tablosu .taksit-tutar-wrapper{background-color:#f7f7f7;}
#paytr_taksit_tablosu .taksit-tutar-wrapper:hover{background-color:#e8e8e8;}
#paytr_taksit_tablosu .taksit-tutari{float:left;width:50%;box-sizing:border-box;padding:6px 0;color:#474747;border:2px solid #fff;}
#paytr_taksit_tablosu .taksit-tutari-bold{font-weight:bold;}
`;

export function PaytrInstallmentTable({ amount }: { amount: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const amountText = Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : "";

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !paytrInstallmentTableEnabled || !amountText) return;
    host.replaceChildren();
    const style = document.createElement("style");
    style.textContent = TABLE_CSS;
    const target = document.createElement("div");
    target.id = "paytr_taksit_tablosu";
    const script = document.createElement("script");
    const params = new URLSearchParams({ token: TABLE_TOKEN, merchant_id: MERCHANT_ID, amount: amountText, taksit: "0", tumu: "0" });
    script.src = `https://www.paytr.com/odeme/taksit-tablosu/v2?${params.toString()}`;
    script.async = true;
    host.append(style, target, script);
    return () => host.replaceChildren();
  }, [amountText]);

  if (!paytrInstallmentTableEnabled || !amountText) return null;
  return <div ref={hostRef} className="mt-3 max-h-[26rem] max-w-full overflow-y-auto overscroll-contain" data-paytr-amount={amountText} />;
}
