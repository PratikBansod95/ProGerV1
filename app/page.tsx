import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getRoleHome } from "@/lib/auth/roles";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(getRoleHome(user.role));
}
