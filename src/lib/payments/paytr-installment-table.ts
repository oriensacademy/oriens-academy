import { kurusToDecimalString } from "./pricing";

// PayTR Mağaza Paneli → Taksit Tablosu entegrasyonu. Mağaza no ve tablo
// anahtarı panelin herkese açık gömme değerleridir (merchant_key / merchant_salt
// DEĞİL; onlar yalnız Edge Function'da). Tanımlı değilse tablo hiç yüklenmez,
// ödeme akışı etkilenmez.
export const PAYTR_INSTALLMENT_TABLE_ENDPOINT = "https://www.paytr.com/odeme/taksit-tablosu/v2";

export const paytrInstallmentTableEnv = {
  merchantId: process.env.NEXT_PUBLIC_PAYTR_MERCHANT_ID?.trim() || "",
  installmentToken: process.env.NEXT_PUBLIC_PAYTR_INSTALLMENT_TOKEN?.trim() || "",
};

// Mağazanın PayTR'deki taksit tanımı; paytr-create-token max_installment ile aynı.
export const PAYTR_STORE_MAX_INSTALLMENT = 12;

export interface PaytrInstallmentTableParams {
  merchantId: string;
  installmentToken: string;
  /** Kullanıcının ödeyeceği son tutar, tam sayı kuruş (calculateAuthoritativeTotal().finalTotalKurus). */
  amountKurus: number;
  /** Gösterilecek en yüksek taksit; 0 = PayTR varsayılanı (panelin verdiği değer). */
  taksit?: number;
  /** 0 = avantajlı seçenekler (panel varsayılanı), 1 = tüm seçenekler. */
  tumu?: 0 | 1;
}

/**
 * Panelin verdiği resmi betik adresini kurar:
 * …/taksit-tablosu/v2?token=…&merchant_id=…&amount=27000.00&taksit=0&tumu=0
 * Eksik / geçersiz girdide null döner (tablo gösterilmez).
 */
export function buildPaytrInstallmentTableUrl({ merchantId, installmentToken, amountKurus, taksit = 0, tumu = 0 }: PaytrInstallmentTableParams): string | null {
  const merchant = merchantId.trim();
  const token = installmentToken.trim();
  const amount = kurusToDecimalString(amountKurus);
  if (!/^\d+$/.test(merchant) || !/^[0-9a-f]{16,128}$/i.test(token) || !amount) return null;
  const maxInstallment = Number.isInteger(taksit) && taksit >= 0 && taksit <= PAYTR_STORE_MAX_INSTALLMENT ? taksit : 0;
  const params = new URLSearchParams({
    token,
    merchant_id: merchant,
    amount,
    taksit: String(maxInstallment),
    tumu: tumu === 1 ? "1" : "0",
  });
  return `${PAYTR_INSTALLMENT_TABLE_ENDPOINT}?${params.toString()}`;
}
