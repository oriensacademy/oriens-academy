import { getSupabaseClient } from "@/lib/supabase/client";
import type { TcmbEurRate } from "@/lib/pricing/tcmb";

export async function getAdminTcmbEurRate(forceRefresh = false): Promise<{
  data: TcmbEurRate | null;
  error: string | null;
}> {
  try {
    const { data, error } = await getSupabaseClient().functions.invoke("tcmb-eur-rate", {
      body: { forceRefresh },
    });
    const rate = data?.rate as TcmbEurRate | undefined;
    if (error || !data?.success || !rate || !Number.isFinite(Number(rate.rate)) || Number(rate.rate) <= 0) {
      return { data: null, error: "Güncel kur bilgisi alınamadı." };
    }
    return { data: { ...rate, rate: Number(rate.rate) }, error: null };
  } catch {
    return { data: null, error: "Güncel kur bilgisi alınamadı." };
  }
}
