// Tek fiyat hesabı: ön yüz, Edge Function'ın (paytr-create-token) kullandığı
// dosyanın aynısını çalıştırır. Sepet / ödeme ekranı / taksit tablosu tutarı
// ile PayTR'ye gönderilen tutar bu yüzden aynı koddan çıkar.
export * from "../../../supabase/functions/_shared/payments/pricing";
