import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./client";

/**
 * Server-only service-role client. Used exclusively by the AI chat endpoint
 * to read AI configuration and persist conversation/usage records after
 * explicit server-side authorization checks. Never import from client code;
 * SUPABASE_SERVICE_ROLE_KEY must never be exposed to the browser.
 */
export function createSupabaseServiceClient(): SupabaseClient | null {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
