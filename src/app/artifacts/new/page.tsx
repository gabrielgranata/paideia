import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";
import { composeArtifact } from "@/app/actions/student";

// /artifacts/new — student creates a composed artifact.
//
// Three intents (study_guide / presentation / test_prep). The student
// picks intent + selects which lessons to draw from + names it +
// optionally describes what they're trying to do. Submitting fires the
// artifact composer LLM call (~6-10s); the page redirects to
// /artifacts/[id] when ready.
//
// Scope discipline: the student picks lessons they've actually engaged
// with (joined to their sessions). Composing across un-engaged material
// would just be the LLM summarizing teacher content — drift toward the
// AI-tutor antipattern.

type EligibleLesson = {
  lesson_id: string;
  lesson_title: string;
  course_title: string;
  has_substrate: boolean;
};

const INTENTS = [
  {
    id: "study_guide" as const,
    label: "Study guide",
    blurb:
      "Organize what you've worked through across lessons — for review, before a test, or to come back to.",
  },
  {
    id: "test_prep" as const,
    label: "Test prep",
    blurb:
      "What you can think through · what you should think through more before the test. Open questions stay open.",
  },
  {
    id: "presentation" as const,
    label: "Presentation",
    blurb:
      "A slide-by-slide outline of your reasoning across selected lessons. You fill in the delivery.",
  },
];

export default async function NewArtifactPage() {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  // Lessons the student has at least started a session on. Composing from
  // un-engaged lessons isn't this artifact's job (teacher content
  // summarization isn't paideia-aligned).
  const lessons = (await sql`
    select distinct
      l.id as lesson_id,
      l.title as lesson_title,
      coalesce(c.title, 'Course') as course_title,
      exists (
        select 1 from nodes n
        join sessions s2 on s2.id = n.session_id
        where s2.student_id = ${user.student_id}
          and s2.lesson_id = l.id
      ) as has_substrate
    from sessions s
    join lessons l on l.id = s.lesson_id
    left join courses c on c.id = l.course_id
    where s.student_id = ${user.student_id}
    order by l.title
  `) as unknown as EligibleLesson[];

  // If they have no engagement yet, send them back with a note.
  if (lessons.length === 0) {
    redirect("/artifacts?need=engagement");
  }

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
        title={user.name}
        subtitle="New artifact"
        backHref="/artifacts"
        backLabel="Your work"
        user={user}
      />

      <div
        style={{
          flex: 1,
          padding: "32px 36px 64px",
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <header style={{ marginBottom: 28 }}>
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
            Compose an artifact from your work
          </h1>
          <p
            style={{
              fontFamily: tokens.font.body,
              fontSize: 13,
              color: tokens.color.sec,
              margin: "8px 0 0",
              fontStyle: "italic",
              lineHeight: 1.65,
            }}
          >
            The system organizes what you&apos;ve already reasoned through —
            it doesn&apos;t add new claims. Open questions you&apos;re still
            holding stay open.
          </p>
        </header>

        <form
          action={composeArtifact}
          style={{ display: "flex", flexDirection: "column", gap: 24 }}
        >
          {/* Intent picker */}
          <fieldset
            style={{
              border: "none",
              padding: 0,
              margin: 0,
            }}
          >
            <legend
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
              Intent
            </legend>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {INTENTS.map((it, idx) => (
                <label
                  key={it.id}
                  htmlFor={`intent-${it.id}`}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "14px 16px",
                    background: tokens.color.cardLight,
                    border: `1px solid ${tokens.color.border}`,
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  <input
                    id={`intent-${it.id}`}
                    type="radio"
                    name="intent"
                    value={it.id}
                    defaultChecked={idx === 0}
                    required
                    style={{
                      marginTop: 4,
                      accentColor: tokens.ai.label,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: tokens.font.body,
                        fontSize: 14,
                        color: tokens.color.text,
                        fontStyle: "italic",
                        marginBottom: 3,
                      }}
                    >
                      {it.label}
                    </div>
                    <div
                      style={{
                        fontFamily: tokens.font.body,
                        fontSize: 12,
                        color: tokens.color.sec,
                        lineHeight: 1.5,
                      }}
                    >
                      {it.blurb}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Title */}
          <Field
            label="Title"
            sub="A short name for this artifact. e.g. &quot;Friday's WWI test&quot; or &quot;Class consciousness across the unit&quot;."
          >
            <input
              name="title"
              type="text"
              required
              placeholder="What would you call this?"
              style={inputStyle}
            />
          </Field>

          {/* Prompt — optional context the student wants to add */}
          <Field
            label="What you're trying to do"
            sub="Optional. The composer uses this to shape how it organizes your work — not to add claims you haven't made."
          >
            <textarea
              name="prompt"
              placeholder="e.g. I have a test on Friday on the causes of class consciousness. I want to make sure I can argue that mechanism, not just describe it."
              rows={3}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </Field>

          {/* Lesson selector — multi-checkbox */}
          <Field
            label="Draw from"
            sub="Pick the lessons you've worked through that this artifact should draw on. The composer organizes what you wrote, not what the teacher provided."
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                background: tokens.color.cardLight,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: 4,
                padding: "10px 12px",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {lessons.map((l) => (
                <label
                  key={l.lesson_id}
                  htmlFor={`lesson-${l.lesson_id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 4px",
                    cursor: "pointer",
                    opacity: l.has_substrate ? 1 : 0.5,
                  }}
                  title={
                    l.has_substrate
                      ? undefined
                      : "No substrate yet — write something in this lesson before composing from it."
                  }
                >
                  <input
                    id={`lesson-${l.lesson_id}`}
                    type="checkbox"
                    name="lesson_id"
                    value={l.lesson_id}
                    defaultChecked={l.has_substrate}
                    disabled={!l.has_substrate}
                    style={{ accentColor: tokens.ai.label }}
                  />
                  <div
                    style={{
                      fontFamily: tokens.font.body,
                      fontSize: 13,
                      color: tokens.color.text,
                      fontStyle: "italic",
                    }}
                  >
                    {l.lesson_title}
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: tokens.font.ui,
                      fontSize: 9,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: tokens.color.faint,
                    }}
                  >
                    {l.course_title}
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <div
            style={{
              marginTop: 8,
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
              The composer takes ~6–10 seconds. You&apos;ll land on the artifact when it&apos;s ready.
            </p>
            <Link
              href="/artifacts"
              style={{
                fontFamily: tokens.font.ui,
                fontSize: 10,
                color: tokens.color.ter,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textDecoration: "underline",
              }}
            >
              Cancel
            </Link>
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
              Compose →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
    <label style={{ display: "block" }}>
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
