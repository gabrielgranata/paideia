import { notFound } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { tokens, type Stage, STAGE_LABEL } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";
import { submitAnnotation, composeReading } from "@/app/actions/teacher";

// Teacher's view of one student. Three columns: roster on the left,
// the student's writing in the middle, AI observations + a prompt-to-
// student form on the right. Reads from the student's most recent
// reading + their substrate. For students without a reading yet, the
// middle and right columns degrade to an empty state.

type StudentRow = {
  id: string;
  name: string;
  stage: Stage | null;
  summary: string | null;
  flagged: boolean;
};

type ReadingDerived = {
  resolved?: string;
  in_progress?: string;
  unaddressed?: string;
  recommended_next?: string;
};

type ReadingRow = {
  id: string;
  lesson_id: string;
  derived_content: ReadingDerived | null;
  derived_at: Date | null;
};

type NodeRow = {
  id: string;
  role: "assertion" | "support" | "challenge" | "inquiry";
  kind: string;
  content: string;
  status: "open" | "resolved" | "superseded";
};

type AnnotationRow = {
  id: string;
  body: string;
  created_at: Date;
  status: string;
};

const COURSE_ID = "course_irm_2025";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ student_id: string }>;
}) {
  const user = await requireRole("teacher");
  const { student_id } = await params;

  // Fetch the focused student + the rest of the roster for the sidebar.
  const studentRows = (await sql`
    select id, name, stage, summary, flagged
    from students where id = ${student_id}
  `) as unknown as StudentRow[];
  const student = studentRows[0];
  if (!student) notFound();

  const roster = (await sql`
    select s.id, s.name, s.stage, s.summary, s.flagged
    from course_enrollments e
    join students s on s.id = e.student_id
    where e.course_id = ${COURSE_ID}
    order by s.flagged desc, s.name asc
  `) as unknown as StudentRow[];

  // Most recent reading for this student. v0: only Maya has one in the seed.
  const readingRows = (await sql`
    select id, lesson_id, derived_content, derived_at
    from readings
    where student_id = ${student_id}
    order by derived_at desc nulls last
    limit 1
  `) as unknown as ReadingRow[];
  const reading = readingRows[0] ?? null;

  // The student's open-status nodes — these stand in for the "Claim" /
  // "Evidence" / "Warrant" entry blocks the design renders.
  const nodeRows = reading
    ? ((await sql`
        select n.id, n.role, n.kind, n.content, n.status
        from nodes n
        join sessions s on s.id = n.session_id
        where s.student_id = ${student_id} and s.lesson_id = ${reading.lesson_id}
        order by n.created_at asc
      `) as unknown as NodeRow[])
    : [];

  // Existing annotations on the latest reading.
  const annotationRows = reading
    ? ((await sql`
        select id, body, created_at, status
        from progression_annotations
        where target_type = 'reading' and target_id = ${reading.id}
        order by created_at desc
      `) as unknown as AnnotationRow[])
    : [];

  const claim = pickAssertion(nodeRows);
  const evidence = pickSupport(nodeRows, claim?.id);
  const stageStyle = student.stage ? tokens.stage[student.stage] : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: tokens.color.canvas,
      }}
    >
      <Chrome title={student.name} subtitle="Student detail · Teacher view" user={user} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left — roster */}
        <aside
          style={{
            width: 196,
            borderRight: `1px solid ${tokens.color.border}`,
            background: tokens.color.panel,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: "10px 16px",
              borderBottom: `1px solid ${tokens.color.border}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Link
              href="/teacher"
              style={{
                fontFamily: tokens.font.ui,
                fontSize: 10,
                color: tokens.color.ter,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              ← Back
            </Link>
            <span
              style={{
                fontFamily: tokens.font.ui,
                fontSize: 10,
                color: tokens.color.ter,
                marginLeft: "auto",
                letterSpacing: "0.06em",
              }}
            >
              {roster.length} students
            </span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {roster.map((s) => {
              const active = s.id === student.id;
              return (
                <Link
                  key={s.id}
                  href={`/teacher/student/${s.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 16px",
                    borderBottom: `1px solid ${tokens.color.canvas}`,
                    background: active ? tokens.ai.faint : "transparent",
                    borderLeft: active
                      ? `3px solid ${tokens.ai.label}`
                      : "3px solid transparent",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: tokens.font.body,
                      fontSize: 12,
                      color: tokens.color.text,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {s.name}
                  </span>
                  {s.flagged && (
                    <span
                      style={{
                        fontFamily: tokens.font.ui,
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: "0.10em",
                        textTransform: "uppercase",
                        color: tokens.color.flagLabel,
                      }}
                    >
                      Flagged
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Middle — student's writing */}
        <section
          style={{
            flex: 1,
            padding: "36px 44px",
            overflowY: "auto",
            background: tokens.color.panel,
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <span
              style={{
                fontFamily: tokens.font.body,
                fontSize: 22,
                fontStyle: "italic",
                fontWeight: 500,
                color: tokens.color.text,
              }}
            >
              {student.name}
            </span>
            {stageStyle && (
              <span
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 9px",
                  borderRadius: 20,
                  background: stageStyle.bg,
                  color: stageStyle.text,
                }}
              >
                {student.stage && STAGE_LABEL[student.stage]}
              </span>
            )}
            {student.flagged && (
              <span
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: 11,
                  fontWeight: 600,
                  color: tokens.color.flagLabel,
                  letterSpacing: "0.04em",
                  marginLeft: "auto",
                }}
              >
                Warrant missing
              </span>
            )}
          </header>

          {reading ? (
            <>
              {/*
                The reasoning-arc labels (Claim / Evidence / Warrant) are
                deliberately not surfaced as UX labels — that scaffolding lives
                in the LLM prompt layer, not in what the teacher reads. Here
                the teacher sees the student's positions and where the thinking
                is unfinished, framed in plain language.
              */}
              <EntryBlock label="Latest position" text={claim?.content ?? null} />
              <EntryBlock label="Supporting move" text={evidence?.content ?? null} />
              <EntryBlock
                label="Still working on"
                text={reading.derived_content?.recommended_next ?? null}
                dim
              />
            </>
          ) : (
            <p
              style={{
                fontSize: 14,
                fontStyle: "italic",
                color: tokens.color.ter,
                fontFamily: tokens.font.body,
                lineHeight: 1.7,
              }}
            >
              {student.summary ?? "No completed reading yet."}
            </p>
          )}
        </section>

        {/* Right — AI observations + prompt-to-student */}
        <aside
          style={{
            width: 280,
            borderLeft: `1px solid ${tokens.color.border}`,
            background: tokens.ai.faint,
            padding: "22px 18px",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
          {/* Across-time drill-in — peripheral pointer to /progression.
              The per-session reading below is the snapshot; /progression
              is the arc. Kept structural ("Across-time reading"), not
              evaluative. */}
          <Link
            href={`/progression/${student.id}`}
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: `1px solid ${tokens.color.border}`,
              textDecoration: "none",
              gap: 8,
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
            <span
              style={{
                fontFamily: tokens.font.ui,
                fontSize: 9,
                fontWeight: 700,
                color: tokens.ai.label,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "underline",
              }}
            >
              Open →
            </span>
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 7,
              gap: 8,
            }}
          >
            <Label color={tokens.ai.label}>{tokens.aiMarker} Observations</Label>
            {reading && (
              <form action={composeReading} style={{ display: "inline" }}>
                <input type="hidden" name="student_id" value={student.id} />
                <input type="hidden" name="lesson_id" value={reading.lesson_id} />
                <button
                  type="submit"
                  title="Re-compose this reading from the substrate. ~3-5s."
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 9,
                    fontWeight: 700,
                    color: tokens.ai.label,
                    fontFamily: tokens.font.ui,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  Refresh →
                </button>
              </form>
            )}
          </div>

          {reading?.derived_content ? (
            <>
              {reading.derived_content.resolved && (
                <ObsGood text={reading.derived_content.resolved} />
              )}
              {reading.derived_content.in_progress && (
                <ObsGood text={reading.derived_content.in_progress} />
              )}
              {reading.derived_content.unaddressed && (
                <ObsGap text={reading.derived_content.unaddressed} />
              )}
            </>
          ) : (
            <p
              style={{
                fontSize: 12,
                fontStyle: "italic",
                color: tokens.color.ter,
                fontFamily: tokens.font.body,
                margin: 0,
                lineHeight: 1.65,
              }}
            >
              No observations yet — composer will fill these once the student has a session.
            </p>
          )}

          {/* Prior annotations (most recent first) */}
          {annotationRows.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <Label color={tokens.color.ter}>Sent</Label>
              {annotationRows.map((a) => (
                <div
                  key={a.id}
                  style={{
                    paddingLeft: 10,
                    borderLeft: `1.5px solid ${tokens.color.border}`,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      fontFamily: tokens.font.ui,
                      fontSize: 9,
                      fontWeight: 600,
                      color: tokens.color.faint,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    Mr. Okafor · {fmtDate(a.created_at)} · {a.status}
                  </div>
                  <p
                    style={{
                      fontFamily: tokens.font.body,
                      fontSize: 12,
                      fontStyle: "italic",
                      color: tokens.color.sec,
                      lineHeight: 1.55,
                      margin: 0,
                    }}
                  >
                    {a.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Prompt-to-student form (only if there's a reading to anchor on) */}
          {reading && (
            <form
              action={submitAnnotation}
              style={{
                marginTop: "auto",
                paddingTop: 16,
                background: tokens.color.panel,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: 4,
                padding: 12,
              }}
            >
              <input type="hidden" name="student_id" value={student.id} />
              <input type="hidden" name="target_type" value="reading" />
              <input type="hidden" name="target_id" value={reading.id} />
              <div
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: 9,
                  fontWeight: 700,
                  color: tokens.color.ter,
                  marginBottom: 7,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Prompt to student
              </div>
              <textarea
                name="body"
                placeholder="A question the student can only answer from inside their own thinking…"
                rows={4}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 4,
                  border: `1px solid ${tokens.color.border}`,
                  fontSize: 12,
                  fontFamily: tokens.font.body,
                  fontStyle: "italic",
                  color: tokens.color.text,
                  background: tokens.color.canvas,
                  resize: "vertical",
                  outline: "none",
                  lineHeight: 1.55,
                }}
              />
              <button
                type="submit"
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "7px 0",
                  background: tokens.ai.label,
                  color: tokens.ai.bg,
                  fontFamily: tokens.font.ui,
                  fontSize: 10,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                }}
              >
                SEND TO STUDENT
              </button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────

function pickAssertion(nodes: NodeRow[]): NodeRow | null {
  const open = nodes.filter((n) => n.role === "assertion" && n.status === "open");
  if (open.length > 0) return open[open.length - 1];
  const any = nodes.filter((n) => n.role === "assertion");
  return any[any.length - 1] ?? null;
}

function pickSupport(nodes: NodeRow[], _claimId: string | undefined): NodeRow | null {
  // v0: pick the most recent open support (the "evidence" the teacher
  // sees as backing the live claim). A more honest read would walk the
  // edges; for the dashboard surface this is enough.
  const open = nodes.filter((n) => n.role === "support" && n.status === "open");
  if (open.length > 0) return open[open.length - 1];
  return null;
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── small components ────────────────────────────────────────────────────

function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontFamily: tokens.font.ui,
        fontSize: 8.5,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: color ?? tokens.color.ter,
        marginBottom: 7,
      }}
    >
      {children}
    </div>
  );
}

function EntryBlock({
  label,
  text,
  dim,
}: {
  label: string;
  text: string | null;
  dim?: boolean;
}) {
  return (
    <div style={{ marginBottom: 24, opacity: dim ? 0.55 : 1 }}>
      <Label color={tokens.color.ter}>{label}</Label>
      {text ? (
        <p
          style={{
            fontFamily: tokens.font.body,
            fontSize: 15,
            lineHeight: 1.78,
            color: tokens.color.text,
            margin: 0,
          }}
        >
          {text}
        </p>
      ) : (
        <p
          style={{
            fontFamily: tokens.font.body,
            fontSize: 15,
            lineHeight: 1.78,
            color: tokens.color.textDisabled,
            fontStyle: "italic",
            margin: 0,
          }}
        >
          Not yet written
        </p>
      )}
    </div>
  );
}

function ObsGood({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 5,
        background: tokens.good.bg,
        border: `1px solid ${tokens.good.border}`,
        display: "flex",
        gap: 6,
        alignItems: "flex-start",
        marginBottom: 8,
      }}
    >
      <span style={{ fontSize: 11, color: tokens.good.text, flexShrink: 0, marginTop: 1 }}>
        ✓
      </span>
      <span
        style={{
          fontFamily: tokens.font.body,
          fontSize: 12,
          lineHeight: 1.5,
          color: tokens.good.text,
        }}
      >
        {text}
      </span>
    </div>
  );
}

function ObsGap({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 5,
        background: tokens.color.flagBg,
        border: `1px solid ${tokens.color.flagBd}`,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.flagLabel,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        Gap
      </div>
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 12,
          lineHeight: 1.55,
          color: tokens.color.flagText,
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}

