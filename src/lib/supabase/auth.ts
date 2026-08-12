import { getSupabaseClient } from "./client";
import type { User, Session, AuthError } from "@supabase/supabase-js";

export type AdminAuthResponse = {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
};

/**
 * Authenticates an administrator with email and password via Supabase Auth.
 * Operating strictly client-side to maintain static export compatibility.
 */
export async function adminSignIn(
  email: string,
  pass: string
): Promise<AdminAuthResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) {
    return { user: null, session: null, error };
  }

  // Verify that the user possesses administrative authorization via JWT app_metadata
  const isAdmin = checkUserIsAdmin(data.user);
  if (!isAdmin) {
    await supabase.auth.signOut();
    return {
      user: null,
      session: null,
      error: {
        name: "UnauthorizedError",
        message: "Account does not have administrative privileges.",
        status: 403,
      } as AuthError,
    };
  }

  return { user: data.user, session: data.session, error: null };
}

/**
 * Signs out the currently authenticated admin user.
 */
export async function adminSignOut(): Promise<{ error: AuthError | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Retrieves the current session on the client.
 */
export async function getAdminSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Retrieves the current authenticated user on the client.
 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Checks whether the specified user has administrative authority.
 * Uses strict app_metadata validation: auth.jwt() -> app_metadata -> role = 'admin'.
 * DO NOT check editable user_metadata.
 */
export function checkUserIsAdmin(user: User | null): boolean {
  if (!user) return false;
  const appRole = user.app_metadata?.role;
  return appRole === "admin";
}
