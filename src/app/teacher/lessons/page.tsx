import Link from "next/link";
import { sql } from "@/lib/db";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";

// /teacher/lessons — list of every lesson Mr. K has created. Each row
// links to its composer. Empty state points at /teacher/lessons/new.

type LessonRow = {
  id: string;
  title: string;
  prompt: string;
  course_id: string | null;
  course_title: string | null;
  block_count: number;
  session_count: number;
  created_at: Date;
};

export default async function TeacherLessonsPage() {
  const user = await requireRole("teacher");
  if (!user.teacher_id) throw new Error("Teacher account is missing teacher_id");

  const lessons = (await sql`
    select
      l.id,
      l.title,
      l.prompt,
      l.course_id,
      l.created_at,
      c.title as course_title,
      coalesce(jsonb_array_length(l.blocks), 0)::int as block_count,
      (select count(*)::int from sessions where lesson_id = l.id) as session_count
    from lessons l
    left join courses c on c.id = l.course_id
    where l.teacher_id = ${user.teacher_id}
    order by l.created_at desc
  `) as unknown as LessonRow[];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: tokens.color.canvas,
      }}
    >
      <Chrome
        title="Lessons"
        subtitle={user.name}
        backHref="/teacher"
        backLabel="Class"
        right={`${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"}`}
        user={user}
      >
        <Link
          href="/teacher/lessons/new"
          style={{
            fontSize: 10,
            color: tokens.ai.bg,
            background: tokens.ai.label,
            padding: "5px 12px",
            borderRadius: 4,
            fontFamily: tokens.font.ui,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          + New Lesson
        </Link>
      </Chrome>

      <div style={{ flex: 1, padding: "28px 36px" }}>
        {lessons.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: 14,
            }}
          >
            {lessons.map((l) => (
              <LessonCard key={l.id} lesson={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LessonCard({ lesson }: { lesson: LessonRow }) {
  const date = new Date(lesson.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <Link
      href={`/teacher/lessons/${lesson.id}/edit`}
      style={{
        borderRadius: 5,
        border: `1px solid ${tokens.color.border}`,
        background: tokens.color.cardLight,
        padding: "20px 24px",
        boxShadow: tokens.shadow,
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 9,
            fontWeight: 700,
            color: tokens.color.ter,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
          }}
        >
          {lesson.course_title ?? "Lesson"}
        </span>
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 9,
            color: tokens.color.faint,
            letterSpacing: "0.04em",
          }}
        >
          {date}
        </span>
      </div>
      <h2
        style={{
          fontFamily: tokens.font.body,
          fontSize: 18,
          fontStyle: "italic",
          fontWeight: 500,
          color: tokens.color.text,
          margin: "0 0 10px",
          lineHeight: 1.3,
        }}
      >
        {lesson.title}
      </h2>
      {lesson.prompt && (
        <p
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12,
            lineHeight: 1.6,
            color: tokens.color.sec,
            margin: "0 0 16px",
            fontStyle: "italic",
            // Clamp to ~3 lines without an extra wrapper
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {lesson.prompt}
        </p>
      )}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          gap: 14,
          fontFamily: tokens.font.ui,
          fontSize: 9,
          color: tokens.color.ter,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <span>{lesson.block_count} {lesson.block_count === 1 ? "block" : "blocks"}</span>
        <span>·</span>
        <span>
          {lesson.session_count} {lesson.session_count === 1 ? "session" : "sessions"}
        </span>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        marginTop: 40,
        padding: "60px 40px",
        background: tokens.color.cardLight,
        border: `1px dashed ${tokens.color.border}`,
        borderRadius: 6,
        textAlign: "center",
        maxWidth: 560,
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <h2
        style={{
          fontFamily: tokens.font.body,
          fontSize: 22,
          fontStyle: "italic",
          fontWeight: 500,
          color: tokens.color.text,
          margin: "0 0 10px",
        }}
      >
        No lessons yet.
      </h2>
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 14,
          fontStyle: "italic",
          color: tokens.color.sec,
          margin: "0 0 22px",
          lineHeight: 1.7,
        }}
      >
        Plan a lesson from scratch — give it a title and a central question,
        and you&apos;ll land in the composer to add readings, video, and the
        rest.
      </p>
      <Link
        href="/teacher/lessons/new"
        style={{
          display: "inline-block",
          padding: "10px 22px",
          background: tokens.ai.label,
          color: tokens.ai.bg,
          fontFamily: tokens.font.ui,
          fontSize: 11,
          fontWeight: 700,
          border: "none",
          borderRadius: 4,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        + New lesson
      </Link>
    </div>
  );
}

