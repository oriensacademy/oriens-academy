"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Küçük, bağımlılıksız bir reaktif veri deposu.
 *
 * Neden var: panellerin tamamı veriyi mount anında çekip tam ekran skeleton
 * arkasında bekletiyordu. A ekranından B'ye gidip A'ya dönmek componenti
 * unmount ettiği için her dönüş soğuk bir yükleme oluyordu ("NAVIGATION /
 * INFINITE LOADING AUDIT" §5, §10). Burada üç şeyi birden çözüyoruz:
 *
 *   1. stale-while-revalidate — elde veri varsa ekrana ANINDA basılır,
 *      tazeleme arkada sessizce yapılır. İçerik asla kaybolmaz.
 *   2. in-flight dedup — aynı anahtarı isteyen N component tek istek üretir
 *      (öğrenci detayında 4 ayrı StudentLearningManager 28 sorgu atıyordu).
 *   3. invalidation — bir mutasyondan sonra `invalidate(...)` çağrısı, o
 *      veriyi dinleyen TÜM açık ekranları anında tazeler. Sistemin dinamik
 *      yapısı bozulmaz, aksine güçlenir: kullanıcı güncel veriyi görmek için
 *      F5 atmak zorunda kalmaz.
 *
 * Kasıtlı olarak React Query / SWR eklemedik: mevcut `listX()` fonksiyon
 * imzalarının hiçbiri değişmesin ve regresyon yüzeyi küçük kalsın diye.
 */

export type QuerySnapshot<T> = {
  data: T | null;
  /** Son denemede oluşan hata. Eldeki `data` korunur; ekran boşaltılmaz. */
  error: string | null;
  /** Verinin en son başarıyla tazelendiği an. 0 = hiç yüklenmedi. */
  updatedAt: number;
  /** Şu anda arka planda bir istek uçuyor mu. */
  fetching: boolean;
};

type Entry = {
  snapshot: QuerySnapshot<unknown>;
  inflight: Promise<void> | null;
  rerun: boolean;
  listeners: Set<() => void>;
  fetcher: (() => Promise<unknown>) | null;
  /** Bu kaydı kullanan hook'un bildirdiği tazelik penceresi (ms). */
  staleTime: number;
};

const EMPTY: QuerySnapshot<unknown> = { data: null, error: null, updatedAt: 0, fetching: false };
const entries = new Map<string, Entry>();

/** `updatedAt: 0` "hiç yüklenmedi" demek olduğu için, bayatlatırken 1 kullanıyoruz:
 *  veri ekranda kalır (loading'e düşmez) ama bir sonraki okumada tazelenir. */
const STALE = 1;

function getEntry(key: string): Entry {
  let entry = entries.get(key);
  if (!entry) {
    entry = { snapshot: EMPTY, inflight: null, rerun: false, listeners: new Set(), fetcher: null, staleTime: 30_000 };
    entries.set(key, entry);
  }
  return entry;
}

function emit(entry: Entry) {
  entry.listeners.forEach((listener) => listener());
}

function patch(entry: Entry, next: Partial<QuerySnapshot<unknown>>) {
  entry.snapshot = { ...entry.snapshot, ...next };
  emit(entry);
}

function run(key: string): Promise<void> {
  const entry = getEntry(key);
  // Aynı anahtar için ikinci bir istek açma; ama uçuştayken gelen bir
  // invalidation'ı yutma da -- istek biter bitmez bir kez daha koş.
  if (entry.inflight) {
    entry.rerun = true;
    return entry.inflight;
  }
  const fetcher = entry.fetcher;
  if (!fetcher) return Promise.resolve();

  patch(entry, { fetching: true });

  entry.inflight = (async () => {
    try {
      const data = await fetcher();
      entry.snapshot = { data, error: null, updatedAt: Date.now(), fetching: false };
    } catch (error) {
      // Eldeki veriyi KORU. Bir tazeleme hatası yüzünden dolu bir ekranı
      // boşaltmak, bu audit'te "sonsuz loading" olarak raporlanan davranışın
      // ta kendisiydi.
      entry.snapshot = {
        ...entry.snapshot,
        error: error instanceof Error ? error.message : "Veri yüklenemedi.",
        fetching: false,
      };
    } finally {
      entry.inflight = null;
      if (entry.rerun) {
        entry.rerun = false;
        void run(key);
      }
      emit(entry);
    }
  })();

  return entry.inflight;
}

/**
 * Verilen önekle eşleşen her kaydı tazeler.
 *
 * Ekranda açık (dinleyicisi olan) kayıtlar HEMEN yeniden çekilir; böylece
 * admin panelinde yapılan bir değişiklik, aynı veriyi gösteren diğer açık
 * bölümlere anında yansır. Açık olmayanlar bayat işaretlenir, bir sonraki
 * açılışta eldeki veriyle gösterilip arkada tazelenir.
 */
export function invalidate(...prefixes: string[]) {
  entries.forEach((entry, key) => {
    if (!prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) return;
    if (entry.listeners.size > 0 && entry.fetcher) {
      void run(key);
    } else if (entry.snapshot.updatedAt !== 0) {
      entry.snapshot = { ...entry.snapshot, updatedAt: STALE };
    }
  });
}

/**
 * Önbellekteki veriyi yerinde günceller (iyimser/optimistic güncelleme).
 *
 * Bir toggle veya silme işleminde sunucu cevabını beklemeden ekranı
 * güncellemek için. `updatedAt` bilerek değiştirilmiyor: veri yine de normal
 * tazeleme döngüsünde sunucudan doğrulanır.
 */
export function mutateQuery<T>(key: string, updater: (current: T | null) => T | null) {
  const entry = entries.get(key);
  if (!entry) return;
  entry.snapshot = { ...entry.snapshot, data: updater(entry.snapshot.data as T | null) };
  emit(entry);
}

/** Test/çıkış temizliği: her şeyi unut (örn. signOut sonrası). */
export function clearQueryCache() {
  entries.forEach((entry) => {
    entry.snapshot = EMPTY;
    entry.inflight = null;
    entry.rerun = false;
    emit(entry);
  });
  entries.clear();
}

/**
 * Sekmeye geri dönüldüğünde açık ekranları SESSİZCE tazele.
 *
 * Kritik: burada hiçbir loading state açılmaz ve hiçbir component unmount
 * edilmez -- ekrandaki içerik yerinde kalır, veri arkada güncellenir. Bu,
 * "başka sekmeye gidip dönünce her şey yeniden yükleniyor" şikayetinin
 * doğru çözümü.
 */
let visibilityBound = false;
function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  let last = 0;
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    // `focus` ve `visibilitychange` aynı dönüşte ikisi birden tetiklenir;
    // çift tazelemeyi burada kesiyoruz.
    const now = Date.now();
    if (now - last < 2000) return;
    last = now;
    entries.forEach((entry, key) => {
      if (entry.listeners.size === 0 || !entry.fetcher) return;
      // Sadece bayatlamış kayıtları tazele. Kısa bir alt-tab dönüşünde
      // saniyeler önce çekilmiş veriyi yeniden istemenin anlamı yok.
      const age = Date.now() - entry.snapshot.updatedAt;
      if (entry.snapshot.updatedAt !== 0 && age < entry.staleTime) return;
      void run(key);
    });
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
}

export type UseQueryOptions = {
  /** Bu süreden yeni veri tekrar çekilmez. Varsayılan 30 sn. */
  staleTime?: number;
  /** `false` ise hiç çalışmaz (ör. userId henüz yokken). */
  enabled?: boolean;
};

export type UseQueryResult<T> = {
  data: T | null;
  error: string | null;
  /** SADECE gösterilecek hiçbir veri yokken true. Tazeleme sırasında false. */
  loading: boolean;
  /** Arka planda tazeleme sürüyor (içerik ekranda duruyor). */
  refreshing: boolean;
  refetch: () => Promise<void>;
};

export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: UseQueryOptions = {}
): UseQueryResult<T> {
  const { staleTime = 30_000, enabled = true } = options;
  const active = enabled && !!key;

  // Fetcher her render'da yeni bir closure olabilir; kaydı onun kimliğine
  // bağlamıyoruz, sadece en güncelini çağırıyoruz. Ref render sırasında değil
  // efektte güncelleniyor; bu efekt aşağıdaki çalıştırma efektinden ÖNCE
  // tanımlı olduğu için ilk mount'ta da doğru fetcher görülüyor.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!active || !key) return () => {};
      bindVisibility();
      const entry = getEntry(key);
      entry.listeners.add(onStoreChange);
      return () => {
        entry.listeners.delete(onStoreChange);
      };
    },
    [active, key]
  );

  const getSnapshot = useCallback(
    () => (active && key ? getEntry(key).snapshot : EMPTY),
    [active, key]
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  useEffect(() => {
    if (!active || !key) return;
    const entry = getEntry(key);
    entry.fetcher = () => fetcherRef.current();
    entry.staleTime = staleTime;
    const fresh = entry.snapshot.updatedAt > STALE && Date.now() - entry.snapshot.updatedAt < staleTime;
    if (!fresh) void run(key);
  }, [active, key, staleTime]);

  const refetch = useCallback(() => (active && key ? run(key) : Promise.resolve()), [active, key]);

  return {
    data: snapshot.data as T | null,
    error: snapshot.error,
    loading: active ? snapshot.updatedAt === 0 : false,
    refreshing: snapshot.fetching && snapshot.updatedAt !== 0,
    refetch,
  };
}

/** Uygulama genelinde kullanılan cache anahtarları tek yerde dursun. */
export const queryKeys = {
  adminStudents: "admin:students",
  adminDashboard: "admin:dashboard",
  adminBookings: "admin:bookings",
  adminContacts: "admin:contacts",
  adminPayments: "admin:payments",
  adminBlog: "admin:blog",
  adminDeliveries: "admin:deliveries",
  studentLearning: (userId: string) => `student:learning:${userId}`,
  studentLearningAll: "student:learning",
  studentPortal: (userId: string) => `student:portal:${userId}`,
  studentPortalAll: "student:portal",
} as const;

/**
 * Öğrenciyle ilgili herhangi bir mutasyondan sonra çağrılır. Admin listesi,
 * öğrenci detayının tüm sekmeleri ve öğrenci portalı aynı anda tazelenir.
 */
export function invalidateStudentData() {
  invalidate(
    queryKeys.adminStudents,
    queryKeys.studentLearningAll,
    queryKeys.studentPortalAll,
    queryKeys.adminDashboard,
    queryKeys.adminBookings,
    queryKeys.adminPayments
  );
}
