"use client";

import { useEffect, useState } from "react";

/**
 * Bir değerin "durulmuş" halini döndürür.
 *
 * Admin liste ekranlarında arama kutusu doğrudan sorgu bağımlılığıydı: her
 * tuş vuruşu yeni bir Supabase sorgusu tetikliyor, önceki istek iptal
 * edilmediği için sonuçlar yarışıyordu. Sorguyu durulmuş değere bağlamak hem
 * istek sayısını hem de yazarken hissedilen takılmayı ortadan kaldırıyor.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return;
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs, debounced]);

  return debounced;
}
