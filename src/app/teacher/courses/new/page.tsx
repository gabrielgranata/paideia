import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";
import { createCourse } from "@/app/actions/teacher";

// /teacher/courses/new — Course shell.
//
// A course is the container lessons live under. The teacher names it,
// (optionally) gives it a subject / term / year group, and (optionally)
// seeds an arc — the through-line they want the lessons to cumulatively
// build toward. Submit lands the teacher on /teacher/lessons/new to plan
// the first lesson under the new course.

export default async function NewCoursePage() {
  const user = await requireRole("teacher");
  if (!user.teacher_id) throw new Error("Teacher account is missing teacher_id");

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
        title="New course"
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
            Start a course
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
            A course is the through-line lessons accumulate against. Title is
            the only required field; the arc seed is optional and editable
            later — describe, if you want, what you hope the term builds toward.
          </p>
        </header>

        <form
          action={createCourse}
          style={{
            background: tokens.color.cardLight,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: 6,
            padding: "32px 36px",
            boxShadow: tokens.shadow,
          }}
        >
          <Field label="Title" sub="What you'll call the course. Students see it on their lesson cards.">
            <input
              name="title"
              type="text"
              required
              placeholder="e.g. AP World History 2024"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: "flex", gap: 18 }}>
            <div style={{ flex: 1 }}>
              <Field label="Subject" sub="Optional.">
                <input
                  name="subject"
                  type="text"
                  placeholder="e.g. World History"
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Term" sub="Optional.">
                <input
                  name="term"
                  type="text"
                  placeholder="e.g. Fall 2024"
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <Field label="Year group" sub="Optional. Helps frame the cohort.">
            <input
              name="year_group"
              type="text"
              placeholder="e.g. 10th grade"
              style={inputStyle}
            />
          </Field>

          <Field
            label="Arc seed"
            sub="Optional. What do you want students to be unable to stop thinking about across the term? Edit later as the arc clarifies."
          >
            <textarea
              name="arc_seed_text"
              placeholder="e.g. How do political ideas travel — and what changes when they cross a border, a class line, or a century?"
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontStyle: "italic" }}
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
              You&apos;ll land on the lesson planner next, with this course
              already selected.
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
              Create course →
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
