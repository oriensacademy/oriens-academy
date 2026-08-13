import type { User, Session } from "@supabase/supabase-js";

export interface AdminProfile {
  user_id: string;
  display_name: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type AdminAuthStatus =
  | "loading"
  | "unauthenticated"
  | "unauthorized"
  | "authenticated";

export interface AdminAuthContextValue {
  status: AdminAuthStatus;
  user: User | null;
  session: Session | null;
  profile: AdminProfile | null;
  error: string | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}
