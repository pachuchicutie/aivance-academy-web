"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./client";

let authClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Browser client with cookie-based sessions (via @supabase/ssr) so the
 * server can authenticate portal requests. Used for login, invite/account
 * setup, and any authenticated browser-side reads (RLS applies).
 */
export function createSupabaseAuthClient() {
  const { url, anonKey } = getSupabaseEnv();

  if (!url || !anonKey) {
    throw new Error(
      "Supabase environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  if (!authClient) {
    authClient = createBrowserClient(url, anonKey);
  }

  return authClient;
}
