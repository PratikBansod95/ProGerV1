"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getRoleHome } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (initialError === "config") {
      return "App is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables, then redeploy.";
    }
    if (initialError === "middleware") {
      return "Something went wrong loading the app. Check Vercel logs and Supabase settings.";
    }
    if (initialError === "inactive") {
      return "Your account is inactive. Contact your Admin.";
    }
    if (initialError === "unauthorized") {
      return "You do not have access to that page.";
    }
    return null;
  });
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Invalid email or password.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Invalid email or password.");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("role, status")
        .eq("id", user.id)
        .single();

      if (profile?.status === "inactive") {
        await supabase.auth.signOut();
        setError("Your account is inactive. Contact your Admin.");
        return;
      }

      router.push(getRoleHome(profile?.role ?? "team_member"));
      router.refresh();
    });
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email first, then click Forgot password.");
      return;
    }

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/auth/callback` }
    );

    if (resetError) {
      setError("Could not send reset email. Try again.");
      return;
    }

    setError(null);
    alert("If that email exists, a reset link has been sent.");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">ProGer</CardTitle>
        <CardDescription>
          Project management with automatic risk detection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="flex gap-2">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in..." : "Log In"}
          </Button>

          <button
            type="button"
            onClick={handleForgotPassword}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Forgot password?
          </button>

          <p className="text-center text-sm text-muted-foreground">
            New here? Contact your Admin.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
