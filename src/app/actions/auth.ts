"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { COOKIE_NAME, homeForRole, type CurrentUser, type Role } from "@/lib/auth";
import { getOrCreateScope } from "@/lib/backboard";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  teacher_id: string | null;
  student_id: string | null;
};

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

async function setSessionCookie(user: CurrentUser): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function signInAs(formData: FormData): Promise<void> {
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) throw new Error("user_id missing");

  const rows = (await sql`
    select id, email, name, role, teacher_id, student_id
    from users
    where id = ${userId}
  `) as unknown as UserRow[];

  const row = rows[0];
  if (!row) throw new Error(`Unknown user: ${userId}`);

  const user: CurrentUser = {
    role: row.role,
    id: row.id,
    name: row.name,
    email: row.email,
    teacher_id: row.teacher_id,
    student_id: row.student_id,
  };

  await setSessionCookie(user);
  redirect(homeForRole(user.role));
}

// signUpAsStudent — invoked from /signup. Creates a students row + a
// users row pointing at it, then signs the new account in. After signup
// the student lands on /courses to choose what to enroll in.
export async function signUpAsStudent(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name) throw new Error("Name is required");
  if (!email || !email.includes("@")) throw new Error("Email is required");

  const existing = (await sql`
    select id from users where email = ${email}
  `) as unknown as Array<{ id: string }>;
  if (existing.length > 0) {
    throw new Error(`An account already exists for ${email}.`);
  }

  const studentId = newId("student");
  const userId = newId("user");

  await sql`
    insert into students (id, name)
    values (${studentId}, ${name})
  `;
  await sql`
    insert into users (id, email, name, role, teacher_id, student_id)
    values (${userId}, ${email}, ${name}, 'student', null, ${studentId})
  `;

  const user: CurrentUser = {
    role: "student",
    id: userId,
    name,
    email,
    teacher_id: null,
    student_id: studentId,
  };

  // Create the per-student backboard assistant up front. Best-effort: if
  // backboard is down the signup still succeeds; the scope will be created
  // lazily on first activity that needs it.
  try {
    await getOrCreateScope("student", studentId);
  } catch (err) {
    console.error("[signUpAsStudent] backboard scope create failed:", err);
  }

  await setSessionCookie(user);
  redirect("/courses");
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  redirect("/login");
}
