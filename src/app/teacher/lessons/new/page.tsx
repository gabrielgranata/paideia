import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";
import { addLesson } from "@/app/actions/teacher";

// /teacher/lessons/new — Lesson Plan from scratch.
//
// The design pattern: the central question is the hero. The teacher fills
// in a title, an opening question, and an optional context frame. Submit
// creates the lesson with a Context + Prompt + Response block sequence
// and drops the teacher into the composer to flesh out the rest.
//
// v0: one course in the seed → no selector needed; we render the course
// name as static context. If multiple courses exist, a `<select>` appears.

type CourseRow = {
  id: string;
  title: string;
  subject: string | null;
};

export default async function NewLessonPage() {
  const user = await requireRole("teacher");
  if (!user.teacher_id) throw new Error("Teacher account is missing teacher_id");

  const courses = (await sql`
    select id, title, subject
    from courses
    where teacher_id = ${user.teacher_id}
    order by created_at desc
  `) as unknown as CourseRow[];

  if (courses.length === 0) {
    redirect("/teacher/courses/new");
  }

  const defaultCourse = courses[0];

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
        title="New lesson"
        subtitle={defaultCourse.title}
        backHref="/teacher"
        backLabel="Class"
        user={user}
      />

      <div
        style={{
          flex: 1,
          padding: "40px 36px",
          maxWidth: 820,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <header style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontFamily: tokens.font.body,
              fontSize: 28,
              fontStyle: "italic",
              fontWeight: 500,
              color: tokens.color.text,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Plan a lesson from scratch
          </h1>
          <p
            style={{
              fontFamily: tokens.font.body,
              fontSize: 14,
              color: tokens.color.sec,
              margin: "10px 0 0",
              fontStyle: "italic",
              lineHeight: 1.6,
            }}
          >
            The central question is the load-bearing thing. Title and context
            are the frame; you can flesh out blocks (readings, video, AI
            generated, quiz) once the lesson is created.
          </p>
        </header>

        <form
          action={addLesson}
          style={{
            background: tokens.color.cardLight,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: 6,
            padding: "32px 36px",
            boxShadow: tokens.shadow,
          }}
        >
          {/* Course selector (or hidden input if only one) */}
          {courses.length === 1 ? (
            <input type="hidden" name="course_id" value={defaultCourse.id} />
          ) : (
            <Field label="Course">
              <select
                name="course_id"
                required
                defaultValue={defaultCourse.id}
                style={{
                  ...inputStyle,
                  appearance: "none",
                  backgroundImage:
                    "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
                  backgroundPosition:
                    "calc(100% - 16px) 50%, calc(100% - 11px) 50%",
                  backgroundSize: "5px 5px, 5px 5px",
                  backgroundRepeat: "no-repeat",
                  paddingRight: 28,
                }}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.subject ? ` · ${c.subject}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Title" sub="A short name for your reference. Students see it on their lesson card.">
            <input
              name="title"
              type="text"
              required
              placeholder="e.g. Class consciousness in industrializing Britain"
              style={inputStyle}
            />
          </Field>

          <Field
            label="Central question"
            sub="What you want students to be unable to stop thinking about. This becomes the prompt block in the lesson."
          >
            <textarea
              name="prompt"
              required
              placeholder="e.g. What turns shared experience into shared political consciousness — and what counts as evidence that the turn has happened?"
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontStyle: "italic" }}
            />
          </Field>

          <Field
            label="Opening context"
            sub="Optional — what frames the question. Edit later in the composer if you want."
          >
            <textarea
              name="context"
              placeholder="e.g. We've spent two sessions on factory conditions. Today we ask what made the conditions political — what turned grievance into organization."
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </Field>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <p
              style={{
                fontFamily: tokens.font.body,
                fontSize: 12,
                color: tokens.color.ter,
                fontStyle: "italic",
                margin: 0,
                flex: 1,
              }}
            >
              You&apos;ll land in the composer to add readings, video, AI
              generated content, or a quiz.
            </p>
            <button
              type="submit"
              style={{
                padding: "10px 22px",
                background: tokens.ai.label,
                color: tokens.ai.bg,
                fontFamily: tokens.font.ui,
                fontSize: 11,
                fontWeight: 700,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              Create lesson →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── small components ────────────────────────────────────────────────────

function Field({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: 22 }}>
      <span
        style={{
          display: "block",
          fontFamily: tokens.font.ui,
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.ter,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      {sub && (
        <span
          style={{
            display: "block",
            fontFamily: tokens.font.body,
            fontSize: 12,
            color: tokens.color.ter,
            fontStyle: "italic",
            marginBottom: 8,
            lineHeight: 1.55,
          }}
        >
          {sub}
        </span>
      )}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  fontFamily: tokens.font.body,
  fontSize: 15,
  color: tokens.color.text,
  background: tokens.color.canvas,
  border: `1px solid ${tokens.color.border}`,
  borderRadius: 4,
  outline: "none",
  lineHeight: 1.4,
};

