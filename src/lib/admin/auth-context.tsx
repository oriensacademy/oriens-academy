"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { checkUserIsAdmin, adminSignOut } from "@/lib/supabase/auth";
import type {
  AdminAuthContextValue,
  AdminAuthStatus,
  AdminProfile,
} from "./types";

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(
  undefined
);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AdminAuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyAndSetAdmin = useCallback(async (currentSession: Session | null) => {
    if (!currentSession || !currentSession.user) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setError(null);
      setStatus("unauthenticated");
      return;
    }

    const currentUser = currentSession.user;

    // 1. JWT app_metadata authorization check
    const isAdmin = checkUserIsAdmin(currentUser);
    if (!isAdmin) {
      console.warn("[AdminAuth] Session user lacks app_metadata role = 'admin'.");
      await adminSignOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setError("Account does not have administrative privileges.");
      setStatus("unauthorized");
      return;
    }

    // 2. Database admin_profiles verification
    try {
      const supabase = getSupabaseClient();
      const { data, error: profileErr } = await supabase
        .from("admin_profiles")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (profileErr) {
        console.error("[AdminAuth] Error fetching admin profile:", profileErr);
      }

      if (!data || data.active !== true || data.role !== "admin") {
        console.warn("[AdminAuth] Admin profile is missing, inactive, or has an invalid role.");
        await adminSignOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        setError("Admin profile is inactive or unconfigured.");
        setStatus("unauthorized");
        return;
      }

      setUser(currentUser);
      setSession(currentSession);
      setProfile(data as AdminProfile);
      setError(null);
      setStatus("authenticated");
    } catch (err) {
      console.error("[AdminAuth] Unexpected error during admin verification:", err);
      setUser(null);
      setSession(null);
      setProfile(null);
      setError("An error occurred verifying administrator authorization.");
      setStatus("unauthorized");
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      verifyAndSetAdmin(initialSession);
    });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setSession(null);
        setProfile(null);
        setError(null);
        setStatus("unauthenticated");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        // Supabase may emit SIGNED_IN again when an already-authenticated tab
        // regains focus. Keep the verified admin tree mounted while silently
        // revalidating so open drawers, modals, filters, and form state survive.
        await verifyAndSetAdmin(newSession);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [verifyAndSetAdmin]);

  const handleSignOut = async () => {
    setStatus("loading");
    await adminSignOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setError(null);
    setStatus("unauthenticated");
  };

  const handleRefresh = async () => {
    setStatus("loading");
    const supabase = getSupabaseClient();
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    await verifyAndSetAdmin(freshSession);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        status,
        user,
        session,
        profile,
        error,
        signOut: handleSignOut,
        refreshSession: handleRefresh,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
