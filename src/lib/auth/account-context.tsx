"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";
import type { AdminProfile } from "@/lib/admin/types";

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

async function resolveAccount(session: Session): Promise<AccountResolution> {
  const supabase = getSupabaseClient();
  const user = session.user;

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

  const { data: studentProfile } = await supabase
    .from("student_profiles")
    .select("*")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (studentProfile) {
    return { accountType: "student", adminProfile: null, studentProfile };
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

  const clearAccount = useCallback(() => {
    setSession(null);
    setAccountType("unauthenticated");
    setAdminProfile(null);
    setStudentProfile(null);
  }, []);

  const applySession = useCallback(async (nextSession: Session | null) => {
    const request = ++requestRef.current;
    setIsInitializing(true);
    if (!nextSession) {
      clearAccount();
      setIsInitializing(false);
      return;
    }
    const resolution = await resolveAccount(nextSession);
    if (request !== requestRef.current) return;
    if (resolution.accountType === "unknown") {
      authOperationRef.current = true;
      try { await getSupabaseClient().auth.signOut(); } finally { authOperationRef.current = false; }
      clearAccount();
      setIsInitializing(false);
      return;
    }
    setSession(nextSession);
    setAccountType(resolution.accountType);
    setAdminProfile(resolution.adminProfile);
    setStudentProfile(resolution.studentProfile);
    setIsInitializing(false);
  }, [clearAccount]);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();
    let unsubscribe = () => {};

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await applySession(data.session);
      if (!active) return;
      const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (authOperationRef.current) return;
        if (!["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) return;
        queueMicrotask(() => { if (active) void applySession(nextSession); });
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    });

    return () => { active = false; unsubscribe(); };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const supabase = getSupabaseClient();
    authOperationRef.current = true;
    setIsInitializing(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error || !data.session || !data.user) {
        clearAccount();
        setIsInitializing(false);
        return { accountType: "unauthenticated", user: null, error };
      }
      const resolution = await resolveAccount(data.session);
      if (resolution.accountType === "unknown") {
        await supabase.auth.signOut();
        clearAccount();
        setIsInitializing(false);
        return { accountType: "unknown", user: data.user, error: null };
      }
      setSession(data.session);
      setAccountType(resolution.accountType);
      setAdminProfile(resolution.adminProfile);
      setStudentProfile(resolution.studentProfile);
      setIsInitializing(false);
      return { accountType: resolution.accountType, user: data.user, error: null };
    } finally {
      authOperationRef.current = false;
    }
  }, [clearAccount]);

  const signOut = useCallback(async () => {
    authOperationRef.current = true;
    try {
      await getSupabaseClient().auth.signOut();
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

  return <AccountContext.Provider value={{ session, user: session?.user ?? null, accountType, adminProfile, studentProfile, isInitializing, signIn, signOut, refreshAccount }}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used within AccountProvider");
  return value;
}
