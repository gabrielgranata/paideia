import Link from "next/link";
import { sql } from "@/lib/db";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";
import { createNote } from "@/app/actions/student";

// Student artifact home. Direction E: cream throughout, no AI marker on
// this surface — the page is the student's by default.
//
// Layout:
//   - Sessions (active + completed) — what the student has been working on
//   - Available lessons — lessons in enrolled courses they haven't started
//   - Notes — hardcoded fixtures for now
//
// New students see an empty Sessions row + the available lessons from
// whatever they've enrolled in. If they're not enrolled in anything, the
// page degrades to an "enroll in a course" CTA.

type SessionRow = {
  id: string;
  status: "active" | "completed";
  lesson_id: string;
  lesson_title: string;
  course_subject: string | null;
  created_at: Date;
};

type AvailableLessonRow = {
  lesson_id: string;
  lesson_title: string;
  course_id: string;
  course_title: string;
  course_subject: string | null;
};

type ComposedArtifactRow = {
  id: string;
  type: "study_guide" | "presentation" | "test_prep";
  title: string;
  status: "pending" | "composing" | "ready" | "failed";
  created_at: Date;
};

type NoteRow = {
  id: string;
  title: string;
  spec_json: { widgets?: { type: string }[] } | null;
  updated_at: Date;
};

const HARDCODED_NOTES = [
  "Class notes",
  "First thoughts",
  "Open questions",
];

export default async function ArtifactsPage() {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const sessions = (await sql`
    select
      s.id,
      s.status,
      s.lesson_id,
      l.title as lesson_title,
      c.subject as course_subject,
      s.created_at
    from sessions s
    join lessons l on l.id = s.lesson_id
    left join courses c on c.id = l.course_id
    where s.student_id = ${user.student_id}
    order by s.created_at desc
  `) as unknown as SessionRow[];

  const startedLessonIds = new Set(sessions.map((s) => s.lesson_id));

  const availableLessons = (await sql`
    select
      l.id as lesson_id, l.title as lesson_title,
      c.id as course_id, c.title as course_title, c.subject as course_subject
    from course_enrollments e
    join courses c on c.id = e.course_id
    join lessons l on l.course_id = c.id
    where e.student_id = ${user.student_id}
    order by c.title asc, l.created_at asc
  `) as unknown as AvailableLessonRow[];

  const unstarted = availableLessons.filter((l) => !startedLessonIds.has(l.lesson_id));
  const noEnrollments = availableLessons.length === 0;

  // Composed artifacts (study_guide / presentation / test_prep) the
  // student has created. Includes in-flight ('composing') so the page
  // shows them while the LLM works.
  const composedArtifacts = (await sql`
    select id, type, title, status, created_at
    from artifacts
    where owner_type = 'student'
      and owner_id = ${user.student_id}
      and type in ('study_guide', 'presentation', 'test_prep')
    order by created_at desc
  `) as unknown as ComposedArtifactRow[];

  // Notion-style notes — student-composed widget canvases.
  const notes = (await sql`
    select id, title, spec_json, updated_at
    from artifacts
    where owner_type = 'student'
      and owner_id = ${user.student_id}
      and type = 'note'
    order by updated_at desc
  `) as unknown as NoteRow[];

  const hasAnyEngagement = sessions.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Chrome title={user.name} subtitle="Your work" user={user} />

      <div style={{ flex: 1, padding: "28px 36px" }}>
        {noEnrollments && sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Sessions in progress / complete */}
            {sessions.length > 0 && (
              <>
                <SectionHead label="Sessions" />
                <Grid>
                  {sessions.map((s) => (
                    <SessionCard key={s.id} session={s} />
                  ))}
                </Grid>
              </>
            )}

            {/* Available lessons (not yet started) */}
            {unstarted.length > 0 && (
              <>
                <div style={{ marginTop: sessions.length > 0 ? 36 : 0 }} />
                <SectionHead
                  label="Available lessons"
                  action={{ href: "/courses", text: "+ More courses" }}
                />
                <Grid>
                  {unstarted.map((l) => (
                    <AvailableLessonCard key={l.lesson_id} lesson={l} />
                  ))}
                </Grid>
              </>
            )}

            {/* Composed artifacts (study guides, presentations, test prep) */}
            <div style={{ marginTop: 36 }} />
            <SectionHead
              label="Composed artifacts"
              action={
                hasAnyEngagement
                  ? { href: "/artifacts/new", text: "+ New artifact" }
                  : undefined
              }
            />
            {composedArtifacts.length > 0 ? (
              <Grid>
                {composedArtifacts.map((a) => (
                  <ComposedArtifactCard key={a.id} artifact={a} />
                ))}
              </Grid>
            ) : (
              <p
                style={{
                  fontFamily: tokens.font.body,
                  fontSize: 13,
                  fontStyle: "italic",
                  color: tokens.color.ter,
                  margin: 0,
                  padding: "16px 18px",
                  border: `1px dashed ${tokens.color.border}`,
                  borderRadius: 4,
                  background: tokens.color.cardLight,
                  lineHeight: 1.65,
                }}
              >
                {hasAnyEngagement
                  ? "Once you've worked through a lesson, you can compose a study guide, a presentation, or test prep from your reasoning."
                  : "Start a lesson session before composing artifacts. The composer organizes your work — there's nothing to organize yet."}
              </p>
            )}

            <div style={{ marginTop: 36 }} />
            <NotesSectionHead />
            {notes.length > 0 ? (
              <Grid cols={3} compact>
                {notes.map((n) => (
                  <NoteCard key={n.id} note={n} />
                ))}
              </Grid>
            ) : (
              <p
                style={{
                  fontFamily: tokens.font.body,
                  fontSize: 13,
                  fontStyle: "italic",
                  color: tokens.color.ter,
                  margin: 0,
                  padding: "16px 18px",
                  border: `1px dashed ${tokens.color.border}`,
                  borderRadius: 4,
                  background: tokens.color.cardLight,
                  lineHeight: 1.65,
                }}
              >
                No notes yet. Notes are a Notion-style canvas — stack text,
                quotes, and source references; the system can drop in ◆
                observations as you work.
              </p>
            )}

            {/* Across-time drill-in to /progression. Peripheral: lives
                at the foot of the page, below the student's work, so
                Sessions / Notes / Artifacts stay foreground. Only shown
                once the student has started a session — the composer
                needs readings to read across. */}
            {hasAnyEngagement && (
              <div
                style={{
                  marginTop: 36,
                  paddingTop: 18,
                  borderTop: `1px solid ${tokens.color.border}`,
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontFamily: tokens.font.body,
                    fontSize: 12,
                    fontStyle: "italic",
                    color: tokens.color.ter,
                    lineHeight: 1.6,
                  }}
                >
                  {tokens.aiMarker} Across-time reading — how the system reads
                  your reasoning moving across sessions.
                </span>
                <Link
                  href={`/progression/${user.student_id}`}
                  style={{
                    fontFamily: tokens.font.ui,
                    fontSize: 9,
                    fontWeight: 700,
                    color: tokens.ai.label,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    textDecoration: "underline",
                    whiteSpace: "nowrap",
                  }}
                >
                  Your development →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── empty state ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        marginTop: 60,
        padding: "60px 40px",
        background: tokens.color.cardLight,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 6,
        textAlign: "center",
        boxShadow: tokens.shadow,
      }}
    >
      <h2
        style={{
          fontFamily: tokens.font.body,
          fontSize: 24,
          fontStyle: "italic",
          fontWeight: 500,
          color: tokens.color.text,
          margin: "0 0 10px",
          lineHeight: 1.3,
        }}
      >
        Nothing here yet.
      </h2>
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 14,
          color: tokens.color.sec,
          margin: "0 0 24px",
          fontStyle: "italic",
          lineHeight: 1.7,
        }}
      >
        Enroll in a course to see its lessons here. Sessions, explorations, and
        notes will appear as you work.
      </p>
      <Link
        href="/courses"
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
        Browse courses →
      </Link>
    </div>
  );
}

// ── section primitives ────────────────────────────────────────────────────

function SectionHead({
  label,
  action,
}: {
  label: string;
  action?: { href: string; text: string };
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <span
        style={{
          fontSize: 20,
          fontWeight: 400,
          color: tokens.color.text,
          fontFamily: tokens.font.display,
          fontStyle: "italic",
        }}
      >
        {label}
      </span>
      {action && (
        <Link
          href={action.href}
          style={{
            fontSize: 10,
            color: tokens.color.ter,
            padding: "7px 16px",
            borderRadius: 3,
            border: `1px solid ${tokens.color.border}`,
            background: tokens.color.margin,
            fontFamily: tokens.font.ui,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          {action.text}
        </Link>
      )}
    </div>
  );
}

function Grid({
  children,
  cols = 3,
  compact = false,
}: {
  children: React.ReactNode;
  cols?: number;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: compact ? 10 : 14,
      }}
    >
      {children}
    </div>
  );
}

// ── cards ─────────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: SessionRow }) {
  const isLive = session.status === "active";
  const date = new Date(session.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <Link
      href={`/lesson/${session.id}`}
      style={{
        borderRadius: 5,
        border: `1px solid ${tokens.color.border}`,
        background: tokens.color.card,
        padding: "18px 20px",
        cursor: "pointer",
        boxShadow: tokens.shadow,
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.ter,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          marginBottom: 10,
          fontFamily: tokens.font.ui,
        }}
      >
        Lesson Session
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 400,
          color: tokens.color.text,
          marginBottom: 6,
          fontFamily: tokens.font.display,
          fontStyle: "italic",
          lineHeight: 1.3,
        }}
      >
        {session.lesson_title}
      </div>
      <div
        style={{
          fontSize: 11,
          color: tokens.color.ter,
          marginBottom: 14,
          fontFamily: tokens.font.body,
        }}
      >
        {date}
        {session.course_subject && ` · ${session.course_subject}`}
      </div>
      <span
        style={{
          alignSelf: "flex-start",
          fontSize: 9,
          fontWeight: 600,
          padding: "2px 9px",
          borderRadius: 10,
          background: tokens.color.margin,
          color: tokens.color.ter,
          fontFamily: tokens.font.ui,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {isLive ? "In Progress" : "Complete"}
      </span>
    </Link>
  );
}

function AvailableLessonCard({ lesson }: { lesson: AvailableLessonRow }) {
  return (
    <Link
      href={`/lesson/start/${lesson.lesson_id}`}
      style={{
        borderRadius: 5,
        border: `1px dashed ${tokens.color.border}`,
        background: tokens.color.cardLight,
        padding: "18px 20px",
        cursor: "pointer",
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.ter,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          marginBottom: 10,
          fontFamily: tokens.font.ui,
        }}
      >
        {lesson.course_title}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 400,
          color: tokens.color.text,
          marginBottom: 6,
          fontFamily: tokens.font.display,
          fontStyle: "italic",
          lineHeight: 1.3,
        }}
      >
        {lesson.lesson_title}
      </div>
      <div
        style={{
          fontSize: 11,
          color: tokens.color.ter,
          marginBottom: 14,
          fontFamily: tokens.font.body,
          fontStyle: "italic",
        }}
      >
        Not started
      </div>
      <span
        style={{
          alignSelf: "flex-start",
          fontSize: 9,
          fontWeight: 600,
          padding: "2px 9px",
          borderRadius: 10,
          background: tokens.ai.bg,
          color: tokens.ai.label,
          fontFamily: tokens.font.ui,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        Begin Lesson →
      </span>
    </Link>
  );
}

function ComposedArtifactCard({ artifact }: { artifact: ComposedArtifactRow }) {
  const TYPE_LABEL: Record<ComposedArtifactRow["type"], string> = {
    study_guide: "Study guide",
    presentation: "Presentation",
    test_prep: "Test prep",
  };
  const STATUS_LABEL: Record<ComposedArtifactRow["status"], string> = {
    pending: "Pending",
    composing: "Composing…",
    ready: "Ready",
    failed: "Failed",
  };
  const isReady = artifact.status === "ready";
  const isInFlight = artifact.status === "composing" || artifact.status === "pending";
  const date = new Date(artifact.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <Link
      href={`/artifacts/${artifact.id}`}
      style={{
        borderRadius: 5,
        border: `1px solid ${
          isInFlight ? tokens.ai.border : tokens.color.border
        }`,
        background: isInFlight ? tokens.ai.faint : tokens.color.cardLight,
        padding: "18px 20px",
        boxShadow: tokens.shadow,
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: tokens.ai.label,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          marginBottom: 10,
          fontFamily: tokens.font.ui,
        }}
      >
        {tokens.aiMarker} {TYPE_LABEL[artifact.type]}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 400,
          color: tokens.color.text,
          marginBottom: 6,
          fontFamily: tokens.font.display,
          fontStyle: "italic",
          lineHeight: 1.3,
        }}
      >
        {artifact.title}
      </div>
      <div
        style={{
          fontSize: 11,
          color: tokens.color.ter,
          marginBottom: 14,
          fontFamily: tokens.font.body,
        }}
      >
        {date}
      </div>
      <span
        style={{
          alignSelf: "flex-start",
          fontSize: 9,
          fontWeight: 600,
          padding: "2px 9px",
          borderRadius: 10,
          background:
            artifact.status === "failed"
              ? tokens.color.flagBg
              : isReady
                ? tokens.color.margin
                : tokens.ai.bg,
          color:
            artifact.status === "failed"
              ? tokens.color.flagLabel
              : isReady
                ? tokens.color.ter
                : tokens.ai.label,
          fontFamily: tokens.font.ui,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {isReady ? "Open →" : STATUS_LABEL[artifact.status]}
      </span>
    </Link>
  );
}

// ── Notes section (Notion-style canvases) ────────────────────────────

function NotesSectionHead() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <span
        style={{
          fontSize: 20,
          fontWeight: 400,
          color: tokens.color.text,
          fontFamily: tokens.font.display,
          fontStyle: "italic",
        }}
      >
        Notes
      </span>
      <form action={createNote} style={{ display: "inline" }}>
        <button
          type="submit"
          style={{
            fontSize: 10,
            color: tokens.color.ter,
            padding: "7px 16px",
            borderRadius: 3,
            border: `1px solid ${tokens.color.border}`,
            background: tokens.color.margin,
            fontFamily: tokens.font.ui,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          + New note
        </button>
      </form>
    </div>
  );
}

function NoteCard({ note }: { note: NoteRow }) {
  const widgetCount = note.spec_json?.widgets?.length ?? 0;
  const date = new Date(note.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const preview = findPreviewBody(note.spec_json?.widgets);
  return (
    <Link
      href={`/artifacts/${note.id}`}
      style={{
        borderRadius: 4,
        border: `1px solid ${tokens.color.border}`,
        background: tokens.color.cardLight,
        padding: "12px 14px",
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: 78,
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          color: tokens.color.text,
          fontStyle: "italic",
          lineHeight: 1.3,
          // Clamp to 1 line
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {note.title || "Untitled note"}
      </div>
      {preview && (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 11,
            color: tokens.color.sec,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {preview}
        </div>
      )}
      <div
        style={{
          marginTop: "auto",
          fontFamily: tokens.font.ui,
          fontSize: 9,
          letterSpacing: "0.06em",
          color: tokens.color.faint,
          textTransform: "uppercase",
        }}
      >
        {widgetCount} {widgetCount === 1 ? "widget" : "widgets"} · {date}
      </div>
    </Link>
  );
}

function findPreviewBody(widgets: { type: string }[] | undefined): string | null {
  if (!widgets) return null;
  for (const w of widgets) {
    const body = (w as { body?: unknown }).body;
    if (typeof body === "string" && body.trim().length > 0) {
      return body.trim().slice(0, 200);
    }
  }
  return null;
}
