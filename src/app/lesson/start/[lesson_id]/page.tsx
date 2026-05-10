import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth";

// /lesson/start/[lesson_id] — find or create the session for the current
// student × lesson and redirect to /lesson/[session_id]. This is the route
// that lets a "lesson card" on the artifacts page Just Work for any
// student, including a brand-new account.

type SessionRow = { id: string };
type LessonRow = { id: string; course_id: string | null };

export default async function StartLessonPage({
  params,
}: {
  params: Promise<{ lesson_id: string }>;
}) {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const { lesson_id } = await params;

  const lessonRows = (await sql`
    select id, course_id from lessons where id = ${lesson_id}
  `) as unknown as LessonRow[];
  const lesson = lessonRows[0];
  if (!lesson) notFound();

  // Optional: gate by enrollment if the lesson belongs to a course.
  if (lesson.course_id) {
    const enrolled = (await sql`
      select 1 from course_enrollments
      where course_id = ${lesson.course_id} and student_id = ${user.student_id}
    `) as unknown as Array<unknown>;
    if (enrolled.length === 0) {
      redirect(`/courses?need=${lesson.course_id}`);
    }
  }

  const existing = (await sql`
    select id from sessions
    where student_id = ${user.student_id} and lesson_id = ${lesson_id}
    limit 1
  `) as unknown as SessionRow[];

  if (existing[0]) {
    redirect(`/lesson/${existing[0].id}`);
  }

  const sessionId = `session_${randomUUID().slice(0, 12)}`;
  await sql`
    insert into sessions (id, student_id, lesson_id, status, thread_id)
    values (${sessionId}, ${user.student_id}, ${lesson_id}, 'active', null)
  `;

  redirect(`/lesson/${sessionId}`);
}
