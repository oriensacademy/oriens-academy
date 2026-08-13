import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

let clientInstance: SupabaseClient<Database> | null = null;

/**
 * Returns a browser-safe Supabase client singleton instance.
 *
 * Uses ONLY public browser-safe environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *
 * No privileged service-role credential is accepted by this browser-safe client.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (clientInstance) {
    return clientInstance;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables."
    );
  }

  // Create client
  clientInstance = createClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        persistSession: typeof window !== "undefined",
        autoRefreshToken: typeof window !== "undefined",
      },
    }
  );

  return clientInstance;
}
