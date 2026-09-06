"use client";

import { useState, useTransition } from "react";
import { signInWithName } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LoginUser {
  id: string;
  name: string;
}

export function LoginForm({
  users,
  initialError,
}: {
  users: LoginUser[];
  initialError?: string;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(() => resolveError(initialError));
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedUserId) {
      setError("Select your name to continue.");
      return;
    }

    startTransition(async () => {
      try {
        await signInWithName(selectedUserId);
      } catch {
        setError("Could not sign in. Try again.");
      }
    });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">ProGer</CardTitle>
        <CardDescription>
          Select your name to sign in
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Select
              value={selectedUserId}
              onValueChange={(value) => value && setSelectedUserId(value)}
            >
              <SelectTrigger id="name">
                <SelectValue placeholder="Select your name" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {users.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No active users found. Ask your Admin to add you in Supabase.
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || users.length === 0}
          >
            {isPending ? "Signing in..." : "Continue"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Email login is disabled for now.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function resolveError(code?: string): string | null {
  switch (code) {
    case "config":
      return "App is not configured. Add Supabase env vars (including SUPABASE_SERVICE_ROLE_KEY) in Vercel, then redeploy.";
    case "invalid_name":
      return "That name is not recognized or the account is inactive.";
    case "missing_name":
      return "Select your name to continue.";
    case "auth":
      return "Could not start your session. Check Supabase auth settings.";
    case "inactive":
      return "Your account is inactive. Contact your Admin.";
    case "unauthorized":
      return "You do not have access to that page.";
    default:
      return null;
  }
}
