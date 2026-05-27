import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireUser } from "@/lib/auth";
import { composeStudentProgression } from "@/app/actions/teacher";
import { composeProgression } from "@/app/actions/student";

// Progression view of one student — same content for teacher and student,
// gated by role. Beat 10 shape: four observational moves
// (prior_state → inflection_moment → current_state → recommended_next),
// each anchored to one or more lessons. Composed once per scope and
// stored on `progressions`.
//
// Role gating:
//   teacher → can view any student in the course; refresh runs
//             composeStudentProgression (course-wide OR lesson-scoped).
//   student → can only view their OWN progression; refresh runs the
//             student-side composeProgression (course-wide only — the
//             student action doesn't accept a lesson scope in v0).
//             Lesson-scope query param is ignored for students.
//
// Scope:
//   ?lesson_id=…  → progression scoped to that lesson only (teacher only)
//   default       → progression across the whole active course
//
// Empty state when fewer than 2 readings exist in scope. The composer
// requires comparison between sessions; one session is a snapshot, not a
// progression. Refresh re-runs the composer (~3–5s).

const COURSE_ID = "course_irm_2025";

type ProgressionContent = {
  prior_state: string;
  prior_state_lessons: string[];
  inflection_moment: string;
  inflection_moment_lessons: string[];
  current_state: string;
  current_state_lessons: string[];
  recommended_next: string;
};

type ProgressionRow = {
  derived_content: ProgressionContent | null;
  derived_at: Date | null;
};

type StudentRow = {
  id: string;
  name: string;
};

type LessonRow = {
  id: string;
  title: string;
};

export default async function ProgressionPage({
  params,
  searchParams,
}: {
  params: Promise<{ student_id: string }>;
  searchParams: Promise<{ lesson_id?: string }>;
}) {
  const user = await requireUser();
  const { student_id } = await params;
  const { lesson_id: lessonIdRaw } = await searchParams;

  // Students can only view their own progression. If a student lands on
  // someone else's URL, bounce them to their own — not a 404, since the
  // page exists; they just don't own the scope.
  const isTeacher = user.role === "teacher";
  if (!isTeacher) {
    if (!user.student_id) throw new Error("Student account missing student_id");
    if (user.student_id !== student_id) {
      redirect(`/progression/${user.student_id}`);
    }
  }

  // Lesson scope is teacher-only in v0 — composeProgression (student action)
  // doesn't accept a lesson_id. Silently ignore the query param for students
  // rather than rendering a Refresh that would throw.
  const lessonId =
    isTeacher && lessonIdRaw && lessonIdRaw.trim() ? lessonIdRaw.trim() : null;

  const studentRows = (await sql`
    select id, name from students where id = ${student_id}
  `) as unknown as StudentRow[];
  const student = studentRows[0];
  if (!student) notFound();

  // If a lesson scope is provided, resolve its title for the header chip.
  // Reject lesson ids that don't belong to the active course — silently
  // fall back to course-wide rather than render a misleading scope label.
  let scopedLesson: LessonRow | null = null;
  if (lessonId) {
    const lessonRows = (await sql`
      select id, title from lessons
      where id = ${lessonId} and course_id = ${COURSE_ID}
    `) as unknown as LessonRow[];
    scopedLesson = lessonRows[0] ?? null;
  }
  const effectiveLessonId = scopedLesson ? scopedLesson.id : null;

  // Count of readings in scope — drives the empty-state branch. We allow
  // composing with a single reading so the backboard read/write actually
  // fires on demo systems with only one session in flight; the composer
  // prompt is shaped to handle the single-reading case without inventing
  // an inflection moment that didn't happen.
  const readingCountRows = effectiveLessonId
    ? ((await sql`
        select count(*)::int as n
        from readings r
        join lessons l on l.id = r.lesson_id
        where r.student_id = ${student_id}
          and l.course_id = ${COURSE_ID}
          and r.lesson_id = ${effectiveLessonId}
      `) as unknown as Array<{ n: number }>)
    : ((await sql`
        select count(*)::int as n
        from readings r
        join lessons l on l.id = r.lesson_id
        where r.student_id = ${student_id}
          and l.course_id = ${COURSE_ID}
      `) as unknown as Array<{ n: number }>);
  const readingCount = readingCountRows[0]?.n ?? 0;

  // Existing progression row for (student, course, lesson-scope). Null
  // when never composed; the page shows a "not yet composed" branch in
  // that case (distinct from the <2-readings empty state).
  const progressionRows = effectiveLessonId
    ? ((await sql`
        select derived_content, derived_at
        from progressions
        where student_id = ${student_id}
          and course_id = ${COURSE_ID}
          and lesson_id = ${effectiveLessonId}
        limit 1
      `) as unknown as ProgressionRow[])
    : ((await sql`
        select derived_content, derived_at
        from progressions
        where student_id = ${student_id}
          and course_id = ${COURSE_ID}
          and lesson_id is null
        limit 1
      `) as unknown as ProgressionRow[]);
  const progression = progressionRows[0] ?? null;

  const canCompose = readingCount >= 1;
  const derivedAt = progression?.derived_at
    ? new Date(progression.derived_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

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
        title="Progression"
        subtitle={isTeacher ? `${student.name} · Teacher view` : "Your development"}
        backHref={isTeacher ? `/teacher/student/${student_id}` : "/portfolio"}
        backLabel={isTeacher ? "Student" : "Portfolio"}
        right={
          derivedAt
            ? `Composed ${derivedAt}`
            : canCompose
              ? "Not yet composed"
              : `${readingCount} ${readingCount === 1 ? "session" : "sessions"}`
        }
        user={user}
      />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "40px 48px",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <Header
            studentName={student.name}
            scopedLesson={scopedLesson}
            studentId={student_id}
          />

          {/* Refresh + scope controls. Only rendered when there is
              enough work to actually compose. */}
          {canCompose && (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 32,
                paddingBottom: 14,
                borderBottom: `1px solid ${tokens.color.border}`,
              }}
            >
              <span
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: 9,
                  fontWeight: 700,
                  color: tokens.ai.label,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {tokens.aiMarker} Across-time reading
              </span>
              <form
                action={isTeacher ? composeStudentProgression : composeProgression}
                style={{ display: "inline" }}
              >
                {/* Teacher action needs the explicit student_id (they may
                    be reading any student); the student action derives it
                    from the session cookie. lesson_id is teacher-only. */}
                {isTeacher && (
                  <input type="hidden" name="student_id" value={student_id} />
                )}
                <input type="hidden" name="course_id" value={COURSE_ID} />
                {isTeacher && effectiveLessonId && (
                  <input type="hidden" name="lesson_id" value={effectiveLessonId} />
                )}
                <button
                  type="submit"
                  title="Re-compose the progression from this student's readings (~3-5s)."
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 9,
                    fontWeight: 700,
                    color: tokens.ai.label,
                    fontFamily: tokens.font.ui,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  {progression ? "Refresh →" : "Compose →"}
                </button>
              </form>
            </div>
          )}

          {!canCompose ? (
            <EmptyState />
          ) : !progression?.derived_content ? (
            <NotYetComposed />
          ) : (
            <ProgressionBody content={progression.derived_content} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── header + body ───────────────────────────────────────────────────────

function Header({
  studentName,
  scopedLesson,
  studentId,
}: {
  studentName: string;
  scopedLesson: LessonRow | null;
  studentId: string;
}) {
  return (
    <header style={{ marginBottom: 28 }}>
      <h1
        style={{
          fontFamily: tokens.font.body,
          fontSize: 30,
          fontStyle: "italic",
          fontWeight: 500,
          color: tokens.color.text,
          margin: "0 0 10px",
          lineHeight: 1.2,
        }}
      >
        {studentName}
      </h1>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: tokens.font.ui,
          fontSize: 10,
          color: tokens.color.ter,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span>
          {scopedLesson ? `Lesson scope · ${scopedLesson.title}` : "Across the course"}
        </span>
        {scopedLesson && (
          <Link
            href={`/progression/${studentId}`}
            style={{
              color: tokens.ai.label,
              textDecoration: "underline",
              letterSpacing: "0.06em",
            }}
          >
            ← course-wide
          </Link>
        )}
      </div>
    </header>
  );
}

function ProgressionBody({ content }: { content: ProgressionContent }) {
  return (
    <article>
      <MoveBlock
        label="Earlier"
        prose={content.prior_state}
        anchors={content.prior_state_lessons}
      />
      <MoveBlock
        label="The shift"
        prose={content.inflection_moment}
        anchors={content.inflection_moment_lessons}
      />
      <MoveBlock
        label="Now"
        prose={content.current_state}
        anchors={content.current_state_lessons}
      />
      <MoveBlock
        label="What the system observes next"
        prose={content.recommended_next}
        anchors={null}
      />
    </article>
  );
}

function MoveBlock({
  label,
  prose,
  anchors,
}: {
  label: string;
  prose: string;
  anchors: string[] | null;
}) {
  return (
    <section style={{ marginBottom: 36 }}>
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: tokens.color.ter,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 17,
          lineHeight: 1.78,
          color: tokens.color.text,
          margin: 0,
        }}
      >
        {prose}
      </p>
      {anchors && anchors.length > 0 && (
        <div
          style={{
            marginTop: 10,
            fontFamily: tokens.font.ui,
            fontSize: 9,
            color: tokens.color.faint,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Anchored: {anchors.join(" · ")}
        </div>
      )}
    </section>
  );
}

// ── empty states ────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        padding: "44px 32px",
        background: tokens.color.cardLight,
        border: `1px dashed ${tokens.color.border}`,
        borderRadius: 6,
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 16,
          fontStyle: "italic",
          color: tokens.color.sec,
          lineHeight: 1.7,
          margin: 0,
          maxWidth: 460,
          marginInline: "auto",
        }}
      >
        No completed readings yet in this scope. The progression composes
        from per-lesson readings; once this student has at least one,
        the across-time view will appear here.
      </p>
    </div>
  );
}

function NotYetComposed() {
  return (
    <div
      style={{
        padding: "32px 28px",
        background: tokens.ai.faint,
        border: `1px solid ${tokens.ai.border}`,
        borderRadius: 6,
      }}
    >
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 15,
          fontStyle: "italic",
          color: tokens.ai.text,
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        No progression has been composed yet for this scope. Click{" "}
        <strong>Compose →</strong> to read across this student&apos;s sessions.
      </p>
    </div>
  );
}
