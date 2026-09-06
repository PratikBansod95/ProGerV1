export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return {
    url: url ?? "",
    anonKey: anonKey ?? "",
    isConfigured: Boolean(url && anonKey),
  };
}

export function assertSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env.isConfigured) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return env;
}
