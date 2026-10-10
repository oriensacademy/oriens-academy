// Tek fiyat hesabı: ön yüz, Edge Function'ın (paytr-create-token) kullandığı
// dosyanın aynısını çalıştırır. Ödeme ekranında gösterilen tutar
// ile PayTR'ye gönderilen tutar bu yüzden aynı koddan çıkar.
export * from "../../../supabase/functions/_shared/payments/pricing";
