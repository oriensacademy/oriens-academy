"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { clearQueryCache } from "@/lib/data/query-store";
import type { Tables } from "@/types/database.types";
import type { AdminProfile } from "@/lib/admin/types";
import { recordLoginFailure, recordLoginSuccess } from "@/lib/auth/login-events";

export type AccountType = "admin" | "student" | "unknown" | "unauthenticated";
export type StudentAccountProfile = Tables<"student_profiles">;

type AccountResolution = {
  accountType: Exclude<AccountType, "unauthenticated">;
  adminProfile: AdminProfile | null;
  studentProfile: StudentAccountProfile | null;
};

type SignInResult = {
  accountType: AccountType;
  user: User | null;
  error: AuthError | null;
};

interface AccountContextValue {
  session: Session | null;
  user: User | null;
  accountType: AccountType;
  adminProfile: AdminProfile | null;
  studentProfile: StudentAccountProfile | null;
  isInitializing: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const DEV_AUTH_STORAGE_KEY = "oriens_local_dev_auth";

function createMockDevSession(accountType: "admin" | "student", email: string): {
  session: Session;
  adminProfile: AdminProfile | null;
  studentProfile: StudentAccountProfile | null;
} {
  const userId = accountType === "admin" ? "dev-admin-user-00000000" : "dev-student-user-00000000";
  const user: User = {
    id: userId,
    app_metadata: { role: accountType },
    user_metadata: {
      display_name: accountType === "admin" ? "Oriens Academy Administrator" : "QA Student",
      full_name: accountType === "admin" ? "Oriens Academy Administrator" : "QA Student",
    },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: email.toLowerCase(),
    phone: "",
    role: "authenticated",
    updated_at: new Date().toISOString(),
  };

  const session: Session = {
    access_token: "mock-dev-access-token",
    refresh_token: "mock-dev-refresh-token",
    expires_in: 3600 * 24 * 7,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
    token_type: "bearer",
    user,
  };

  const adminProfile: AdminProfile | null =
    accountType === "admin"
      ? {
          user_id: userId,
          display_name: "Oriens Academy Administrator",
          role: "admin",
          active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : null;

  const studentProfile: StudentAccountProfile | null =
    accountType === "student"
      ? {
          id: userId,
          full_name: "QA Student",
          email: email.toLowerCase(),
          phone: "+90 555 000 0000",
          date_of_birth: null,
          school: "Oriens Academy",
          contact_guardian_name: null,
          grade_level: null,
          education_program: null,
          exams_taken: [],
          target_exam: "SAT / IB",
          target_exams: ["SAT", "IB"],
          target_university: "Oxford / MIT",
          target_country: "UK / USA",
          target_countries: ["UK", "USA"],
          onboarding_completed: true,
          preferred_language: "tr",
          active: true,
          archived_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : null;

  return { session, adminProfile, studentProfile };
}

async function resolveAccount(session: Session): Promise<AccountResolution> {
  // Tarayıcıda saklanan oturum (localStorage) imzası doğrulanmamış bir
  // nesnedir: içine "role: admin" yazılmış sahte bir token paneli açmamalı.
  // Kimlik ve rol yalnızca Supabase Auth'un sunucuda doğruladığı kullanıcıdan
  // okunur; yerel geliştirme mock oturumu bu fonksiyona hiç uğramaz.
  const supabase = getSupabaseClient();
  let user: Session["user"];
  try {
    const { data: verified, error: verifyError } = await supabase.auth.getUser(session.access_token);
    if (verifyError || !verified?.user || verified.user.id !== session.user?.id) {
      return { accountType: "unknown", adminProfile: null, studentProfile: null };
    }
    user = verified.user;
  } catch {
    return { accountType: "unknown", adminProfile: null, studentProfile: null };
  }

  try {
    if (user.app_metadata?.role === "admin") {
      const { data: adminProfile } = await supabase
        .from("admin_profiles")
        .select("user_id,display_name,role,active,created_at,updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (adminProfile?.active === true && adminProfile.role === "admin") {
        return { accountType: "admin", adminProfile: adminProfile as AdminProfile, studentProfile: null };
      }
    }

    // Student profile lookup
    const { data: studentProfile } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (studentProfile) {
      return { accountType: "student", adminProfile: null, studentProfile };
    }

    // Account holder is valid before or alongside student profile.
    const { data: accountHolder } = await supabase
      .from("guardian_accounts")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (accountHolder) {
      return { accountType: "student", adminProfile: null, studentProfile: null };
    }

    // Account-holder and learner records are database-managed. Never synthesize membership client-side.
  } catch {
    /* database offline */
  }

  return { accountType: "unknown", adminProfile: null, studentProfile: null };
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [accountType, setAccountType] = useState<AccountType>("unauthenticated");
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentAccountProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const authOperationRef = useRef(false);
  const requestRef = useRef(0);
  const sessionRef = useRef<Session | null>(null);
  const accountTypeRef = useRef<AccountType>("unauthenticated");

  const clearAccount = useCallback(() => {
    setSession(null);
    sessionRef.current = null;
    setAccountType("unauthenticated");
    accountTypeRef.current = "unauthenticated";
    setAdminProfile(null);
    setStudentProfile(null);
    // Oturum bittiğinde önbelleği de düşür: aksi halde aynı tarayıcıda başka
    // bir hesapla giriş yapan kullanıcı bir önceki hesabın verisini görebilir.
    clearQueryCache();
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(DEV_AUTH_STORAGE_KEY);
      } catch {
        /* storage inaccessible */
      }
    }
  }, []);

  const applySession = useCallback(async (nextSession: Session | null, isBackground = false) => {
    const request = ++requestRef.current;
    if (!isBackground) {
      setIsInitializing(true);
    }
    if (!nextSession) {
      clearAccount();
      setIsInitializing(false);
      return;
    }

    // If same user session in background and account is already resolved, avoid unmounting UI
    if (
      isBackground &&
      sessionRef.current?.user?.id === nextSession.user.id &&
      accountTypeRef.current !== "unauthenticated" &&
      accountTypeRef.current !== "unknown"
    ) {
      // Token gerçekten değişmediyse state'e hiç dokunma. Supabase sekmeye her
      // dönüşte localStorage'dan yeniden parse edilmiş YENİ bir session nesnesi
      // yayıyor; bunu doğrudan state'e yazmak `user` kimliğini değiştirip
      // `[user]` bağımlı tüm efektleri gereksiz yere yeniden çalıştırıyordu.
      const sameToken = sessionRef.current?.access_token === nextSession.access_token;
      sessionRef.current = nextSession;
      if (!sameToken) setSession(nextSession);
      return;
    }

    const resolution = await resolveAccount(nextSession);
    if (request !== requestRef.current) {
      // Bu çağrı eskidi (araya yeni bir applySession girdi). Sonucu yazmıyoruz
      // ama loading bayrağını da açık bırakamayız: araya giren çağrı "arka
      // plan" kısa devresinden dönmüşse isInitializing'i kapatan kimse kalmaz
      // ve panel kalıcı olarak loader'da kilitlenir.
      if (!isBackground) setIsInitializing(false);
      return;
    }
    if (resolution.accountType === "unknown") {
      authOperationRef.current = true;
      try { await getSupabaseClient().auth.signOut(); } catch { /* ignore */ } finally { authOperationRef.current = false; }
      clearAccount();
      setIsInitializing(false);
      return;
    }
    setSession(nextSession);
    sessionRef.current = nextSession;
    setAccountType(resolution.accountType);
    accountTypeRef.current = resolution.accountType;
    setAdminProfile(resolution.adminProfile);
    setStudentProfile(resolution.studentProfile);
    setIsInitializing(false);
  }, [clearAccount]);

  useEffect(() => {
    let active = true;
    const isDev = process.env.NODE_ENV === "development";

    // 1. Check local dev mock session first if in development
    if (isDev && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(DEV_AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as { accountType: "admin" | "student"; email: string };
          const mock = createMockDevSession(parsed.accountType, parsed.email);
          queueMicrotask(() => {
            if (!active) return;
            setSession(mock.session);
            sessionRef.current = mock.session;
            setAccountType(parsed.accountType);
            accountTypeRef.current = parsed.accountType;
            setAdminProfile(mock.adminProfile);
            setStudentProfile(mock.studentProfile);
            setIsInitializing(false);
          });
          return;
        }
      } catch {
        /* ignore storage errors */
      }
    }

    // 2. Otherwise check Supabase session
    const supabase = getSupabaseClient();
    let unsubscribe = () => {};

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await applySession(data.session, false);
      if (!active) return;
      const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (authOperationRef.current) return;
        if (!["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) return;
        const isBackground = event === "TOKEN_REFRESHED" || (event === "SIGNED_IN" && !!sessionRef.current);
        queueMicrotask(() => { if (active) void applySession(nextSession, isBackground); });
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    }).catch(() => {
      if (active) setIsInitializing(false);
    });

    return () => { active = false; unsubscribe(); };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const supabase = getSupabaseClient();
    authOperationRef.current = true;
    setIsInitializing(true);
    const cleanEmail = email.trim().toLowerCase();
    const isDev = process.env.NODE_ENV === "development";

    try {
      // 1. Try real Supabase auth
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error && error.code === "invalid_credentials") recordLoginFailure(cleanEmail);
        if (!error && data.session && data.user) {
          const resolution = await resolveAccount(data.session);
          if (resolution.accountType !== "unknown") {
            recordLoginSuccess();
            setSession(data.session);
            // sessionRef/accountTypeRef, `applySession`'ın "arka plan" kısa
            // devresinin okuduğu tek kaynak. Burada set edilmezlerse, giriş
            // yapmış bir kullanıcı sekmeye her geri döndüğünde Supabase'in
            // yaydığı SIGNED_IN olayı `isBackground === false` hesaplanır,
            // isInitializing true olur ve AdminGuard TÜM paneli unmount edip
            // yeniden kurar (audit: "TAZE LOGIN sonrası sekme dönüşünde admin
            // ağacı unmount"). F5 sonrası sorunun kaybolmasının sebebi de
            // buydu: init yolu ref'leri dolduruyordu.
            sessionRef.current = data.session;
            setAccountType(resolution.accountType);
            accountTypeRef.current = resolution.accountType;
            setAdminProfile(resolution.adminProfile);
            setStudentProfile(resolution.studentProfile);
            setIsInitializing(false);
            return { accountType: resolution.accountType, user: data.user, error: null };
          }
        }
      } catch {
        /* supabase endpoint unreachable */
      }

      // 2. In Local Development Mode: Seamless Fallback for Admin and QA credentials
      if (isDev && process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "true") {
        const isAdminEmail = cleanEmail === "oriensacademy@gmail.com" || cleanEmail === "admin@oriens-academy.com";
        const configuredDevPassword = process.env.NEXT_PUBLIC_DEV_AUTH_PASSWORD;
        const isValidAdminPass = Boolean(configuredDevPassword) && password === configuredDevPassword;

        if (isAdminEmail && isValidAdminPass) {
          const mock = createMockDevSession("admin", cleanEmail);
          setSession(mock.session);
          sessionRef.current = mock.session;
          setAccountType("admin");
          accountTypeRef.current = "admin";
          setAdminProfile(mock.adminProfile);
          setStudentProfile(null);
          setIsInitializing(false);
          try {
            localStorage.setItem(DEV_AUTH_STORAGE_KEY, JSON.stringify({ accountType: "admin", email: cleanEmail }));
          } catch {
            /* ignore */
          }
          return { accountType: "admin", user: mock.session.user, error: null };
        }

        const isStudentEmail = cleanEmail.includes("student") || cleanEmail.includes("ogrenci") || cleanEmail === "qa.student@oriens-academy.com";
        if (isStudentEmail && isValidAdminPass) {
          const mock = createMockDevSession("student", cleanEmail);
          setSession(mock.session);
          sessionRef.current = mock.session;
          setAccountType("student");
          accountTypeRef.current = "student";
          setAdminProfile(null);
          setStudentProfile(mock.studentProfile);
          setIsInitializing(false);
          try {
            localStorage.setItem(DEV_AUTH_STORAGE_KEY, JSON.stringify({ accountType: "student", email: cleanEmail }));
          } catch {
            /* ignore */
          }
          return { accountType: "student", user: mock.session.user, error: null };
        }
      }

      clearAccount();
      setIsInitializing(false);
      return {
        accountType: "unauthenticated",
        user: null,
        error: { name: "AuthError", message: "E-posta adresi veya şifre doğrulanamadı." } as unknown as AuthError,
      };
    } finally {
      authOperationRef.current = false;
    }
  }, [clearAccount]);

  const signOut = useCallback(async () => {
    authOperationRef.current = true;
    try {
      try { await getSupabaseClient().auth.signOut(); } catch { /* ignore */ }
      clearAccount();
      setIsInitializing(false);
    } finally {
      authOperationRef.current = false;
    }
  }, [clearAccount]);

  const refreshAccount = useCallback(async () => {
    const { data } = await getSupabaseClient().auth.getSession();
    await applySession(data.session);
  }, [applySession]);

  // Bu değer memoize edilmezse her provider render'ında yeni bir nesne (ve
  // yeni bir `user` kimliği) yayılır. Supabase, sekmeye her dönüşte SIGNED_IN
  // yayıp `setSession` tetiklediği için, `[user]` bağımlı efektler (ör.
  // BookingFlow, ContactForm) sekme dönüşlerinde gereksiz yere yeniden fetch
  // ediyordu. Kimliği gerçekten değişen alanlara bağlıyoruz.
  const user = session?.user ?? null;
  const value = useMemo(
    () => ({ session, user, accountType, adminProfile, studentProfile, isInitializing, signIn, signOut, refreshAccount }),
    [session, user, accountType, adminProfile, studentProfile, isInitializing, signIn, signOut, refreshAccount]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used within AccountProvider");
  return value;
}
