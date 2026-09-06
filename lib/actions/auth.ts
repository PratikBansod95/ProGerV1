"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isNameLoginConfigured } from "@/lib/supabase/admin";
import { getRoleHome } from "@/lib/auth/roles";
import type { User } from "@/types/database";

export async function getLoginUsers(): Promise<Pick<User, "id" | "name">[]> {
  if (!isNameLoginConfigured()) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  if (error) return [];
  return data ?? [];
}

export async function signInWithName(userId: string) {
  if (!userId) {
    redirect("/login?error=missing_name");
  }

  if (!isNameLoginConfigured()) {
    redirect("/login?error=config");
  }

  const admin = createAdminClient();
  const supabase = await createClient();

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("*")
    .eq("id", userId)
    .eq("status", "active")
    .single();

  if (profileError || !profile) {
    redirect("/login?error=invalid_name");
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
  });

  if (linkError || !linkData.properties?.hashed_token) {
    redirect("/login?error=auth");
  }

  const { error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });

  if (sessionError) {
    redirect("/login?error=auth");
  }

  redirect(getRoleHome(profile.role));
}
