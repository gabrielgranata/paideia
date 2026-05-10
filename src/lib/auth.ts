// Hackathon auth: a cookie carrying { role, id, name } for the active fixture.
// No password, no session store, no real identity. Two fixtures only — Mr. K
// and Maya — both already seeded. The cookie just lets the same browser switch
// between them and lets pages choose the right home.
//
// Replace this with real auth before anyone outside the demo touches it.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Role = "teacher" | "student";
export type CurrentUser = {
  role: Role;
  id: string;        // users.id
  name: string;
  email: string;
  // The linked teacher/student row. One is set, the other null, matching role.
  teacher_id: string | null;
  student_id: string | null;
};

export const COOKIE_NAME = "paideia_user";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CurrentUser>;
    if (parsed.role !== "teacher" && parsed.role !== "student") return null;
    if (!parsed.id || !parsed.name || !parsed.email) return null;
    return parsed as CurrentUser;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireRole(role: Role): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.role !== role) {
    // Bounce to the user's actual home rather than to login — they're signed
    // in, just on the wrong surface for their role.
    redirect(u.role === "teacher" ? "/teacher" : "/artifacts");
  }
  return u;
}

export function homeForRole(role: Role): string {
  return role === "teacher" ? "/teacher" : "/artifacts";
}
