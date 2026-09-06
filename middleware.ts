import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getRoleHome } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database";

const PUBLIC_ROUTES = ["/login", "/auth/callback"];

async function getUserRole(
  supabase: NonNullable<Awaited<ReturnType<typeof updateSession>>["supabase"]>,
  userId: string
): Promise<UserRole> {
  try {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    return (profile?.role ?? "team_member") as UserRole;
  } catch {
    return "team_member";
  }
}

export async function middleware(request: NextRequest) {
  try {
    const { supabase, supabaseResponse, user, configured } =
      await updateSession(request);
    const { pathname } = request.nextUrl;

    if (!configured) {
      if (pathname.startsWith("/login")) {
        return supabaseResponse;
      }

      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "config");
      return NextResponse.redirect(url);
    }

    const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

    if (!user && !isPublic && pathname !== "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (user && supabase) {
      if (pathname === "/login" || pathname === "/") {
        const role = await getUserRole(supabase, user.id);
        const url = request.nextUrl.clone();
        url.pathname = getRoleHome(role);
        return NextResponse.redirect(url);
      }

      if (pathname.startsWith("/hub")) {
        const role = await getUserRole(supabase, user.id);
        if (role !== "admin" && role !== "pm") {
          const url = request.nextUrl.clone();
          url.pathname = getRoleHome(role);
          return NextResponse.redirect(url);
        }
      }

      if (pathname.startsWith("/bucket")) {
        const role = await getUserRole(supabase, user.id);
        if (role === "stakeholder") {
          const url = request.nextUrl.clone();
          url.pathname = "/stakeholder";
          return NextResponse.redirect(url);
        }
      }
    }

    return supabaseResponse;
  } catch (error) {
    console.error("Middleware error:", error);

    if (request.nextUrl.pathname.startsWith("/login")) {
      return NextResponse.next();
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "middleware");
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
