import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

let clientInstance: SupabaseClient<Database> | null = null;

/**
 * Returns a browser-safe Supabase client singleton instance.
 *
 * Uses ONLY public browser-safe environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *
 * Safe for static export (`output: "export"`); handles missing keys at build time gracefully.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (clientInstance) {
    return clientInstance;
  }

  if (!supabaseUrl || !supabasePublishableKey) {
    if (typeof window !== "undefined") {
      console.warn(
        "[Supabase Client] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables."
      );
    }
  }

  // Create client (with dummy fallback during static build if env vars omitted)
  clientInstance = createClient<Database>(
    supabaseUrl || "https://placeholder.supabase.co",
    supabasePublishableKey || "placeholder-key",
    {
      auth: {
        persistSession: typeof window !== "undefined",
        autoRefreshToken: typeof window !== "undefined",
      },
    }
  );

  return clientInstance;
}
