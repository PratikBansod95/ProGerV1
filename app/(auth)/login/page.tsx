import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getRoleHome } from "@/lib/auth/roles";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (getSupabaseEnv().isConfigured) {
    const user = await getCurrentUser();
    if (user) redirect(getRoleHome(user.role));
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <LoginForm initialError={error} />
    </div>
  );
}
