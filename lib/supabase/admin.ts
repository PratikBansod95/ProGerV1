import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error("MISSING_SERVICE_ROLE");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isNameLoginConfigured(): boolean {
  return (
    getSupabaseEnv().isConfigured &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
  );
}
