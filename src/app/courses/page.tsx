import Link from "next/link";
import { sql } from "@/lib/db";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";
import { enrollInCourse } from "@/app/actions/student";

// Course catalog — student-side. Lists every course with an Enroll button
// (or "Enrolled" if already in). Lessons-in-the-course count + the arc
// seed give the student enough to pick.

type CourseRow = {
  id: string;
  title: string;
  subject: string | null;
  term: string | null;
  year_group: string | null;
  arc_seed_text: string | null;
  teacher_name: string;
  lessons_count: number;
  enrolled: boolean;
};

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ need?: string }>;
}) {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const { need } = await searchParams;

  const rows = (await sql`
    select
      c.id, c.title, c.subject, c.term, c.year_group, c.arc_seed_text,
      t.name as teacher_name,
      (select count(*)::int from lessons where course_id = c.id) as lessons_count,
      exists (
        select 1 from course_enrollments e
        where e.course_id = c.id and e.student_id = ${user.student_id}
      ) as enrolled
    from courses c
    join teachers t on t.id = c.teacher_id
    order by c.created_at desc
  `) as unknown as CourseRow[];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: tokens.color.canvas,
      }}
    >
      <Chrome title={user.name} subtitle="Courses" user={user} />

      <div style={{ flex: 1, padding: "28px 36px" }}>
        <header style={{ marginBottom: 22 }}>
          <h1
            style={{
              fontFamily: tokens.font.body,
              fontSize: 24,
              fontStyle: "italic",
              fontWeight: 500,
              color: tokens.color.text,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Available courses
          </h1>
          <p
            style={{
              fontFamily: tokens.font.body,
              fontSize: 13,
              color: tokens.color.sec,
              margin: "6px 0 0",
              fontStyle: "italic",
            }}
          >
            Enroll to add a course to your work. You can leave at any time.
          </p>
          {need && (
            <p
              style={{
                fontFamily: tokens.font.body,
                fontSize: 12,
                color: tokens.color.flagLabel,
                margin: "10px 0 0",
                padding: "8px 12px",
                background: tokens.color.flagBg,
                border: `1px solid ${tokens.color.flagBd}`,
                borderRadius: 4,
              }}
            >
              You aren&apos;t enrolled in that course yet — enroll below to start its lessons.
            </p>
          )}
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: 14,
          }}
        >
          {rows.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: CourseRow }) {
  return (
    <article
      style={{
        background: tokens.color.cardLight,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 5,
        padding: "22px 26px",
        boxShadow: tokens.shadow,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.ter,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {course.subject ?? "Course"}
        {course.term && ` · ${course.term}`}
      </div>
      <h2
        style={{
          fontFamily: tokens.font.body,
          fontSize: 22,
          fontStyle: "italic",
          fontWeight: 500,
          color: tokens.color.text,
          margin: "0 0 6px",
          lineHeight: 1.3,
        }}
      >
        {course.title}
      </h2>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 12,
          color: tokens.color.ter,
          marginBottom: 14,
        }}
      >
        Taught by {course.teacher_name} · {course.lessons_count}{" "}
        {course.lessons_count === 1 ? "lesson" : "lessons"}
      </div>
      {course.arc_seed_text && (
        <p
          style={{
            fontFamily: tokens.font.body,
            fontSize: 13,
            color: tokens.color.sec,
            lineHeight: 1.65,
            fontStyle: "italic",
            margin: "0 0 18px",
          }}
        >
          {course.arc_seed_text}
        </p>
      )}
      <div style={{ marginTop: "auto" }}>
        {course.enrolled ? (
          <Link
            href="/artifacts"
            style={{
              display: "inline-block",
              padding: "8px 18px",
              background: tokens.color.canvas,
              color: tokens.color.text,
              fontFamily: tokens.font.ui,
              fontSize: 10,
              fontWeight: 700,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: 4,
              cursor: "pointer",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            Enrolled · Open lessons →
          </Link>
        ) : (
          <form action={enrollInCourse} style={{ display: "inline" }}>
            <input type="hidden" name="course_id" value={course.id} />
            <button
              type="submit"
              style={{
                padding: "8px 18px",
                background: tokens.ai.label,
                color: tokens.ai.bg,
                fontFamily: tokens.font.ui,
                fontSize: 10,
                fontWeight: 700,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Enroll →
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

