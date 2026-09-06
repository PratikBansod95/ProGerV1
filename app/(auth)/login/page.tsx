import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getRoleHome } from "@/lib/auth/roles";
import { getLoginUsers } from "@/lib/actions/auth";
import { isNameLoginConfigured } from "@/lib/supabase/admin";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (isNameLoginConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect(getRoleHome(user.role));
  }

  const users = await getLoginUsers();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <LoginForm users={users} initialError={error} />
    </div>
  );
}
