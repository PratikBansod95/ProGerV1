import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/types/database";

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  return profile as User | null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status === "inactive") redirect("/login?error=inactive");
  return user;
}

export async function requireRole(allowed: User["role"][]): Promise<User> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    redirect("/login?error=unauthorized");
  }
  return user;
}
