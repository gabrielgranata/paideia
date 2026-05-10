import { redirect } from "next/navigation";
import { getCurrentUser, homeForRole } from "@/lib/auth";

/**
 * Root → role-aware redirect. No cookie → /login picker. Teacher → /teacher.
 * Student → /artifacts. The user lands inside their work, not on a marketing
 * surface or a tool-management screen.
 */
export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(homeForRole(user.role));
}
