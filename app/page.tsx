import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getRoleHome } from "@/lib/auth/roles";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default async function HomePage() {
  if (!getSupabaseEnv().isConfigured) {
    redirect("/login?error=config");
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(getRoleHome(user.role));
}
