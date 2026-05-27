import Link from "next/link";
import { sql } from "@/lib/db";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";
import { composeProgression } from "@/app/actions/student";

// Student Portfolio — the timeline of a student's work across sessions.
// Direction E: cream throughout. Spatial logic split is "teacher provided"
// (olive-tinted artifact cards) vs "your work" (clean cream cards).
//
// Selection state is server-side: ?session=… picks which session is shown.
// Default is the most recent session.
//
// v0 scope: link chips render visually (the ↗ teacher-material pattern and
// ◇ prior-student-work pattern from the design) but the click-to-navigate
// graph traversal is deferred — we don't yet have an artifact graph that
// resolves a chip to its target.

type SessionTimelineRow = {
  session_id: string;
  status: "active" | "completed";
  lesson_id: string;
  lesson_title: string;
  course_id: string | null;
  course_title: string | null;
  course_subject: string | null;
  created_at: Date;
};

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

type LessonBlock = {
  id: string;
  type: "context" | "reading" | "video" | "prompt" | "response" | "ai_generated" | "quiz";
  content: string;
  meta?: string;
  source?: string;
};

type LessonRow = {
  id: string;
  title: string;
  blocks: LessonBlock[] | null;
};

type SubstrateNode = {
  id: string;
  role: "assertion" | "support" | "challenge" | "inquiry";
  kind: string;
  content: string;
  status: "open" | "resolved" | "superseded";
  created_at: Date;
};

type ReadingDerived = {
  resolved?: string;
  in_progress?: string;
  unaddressed?: string;
  recommended_next?: string;
};

type ReadingRow = {
  derived_content: ReadingDerived | null;
};

export default async function StudentPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");
  const { session: sessionParam } = await searchParams;

  // Timeline: every session this student has, oldest first (so the timeline
  // reads chronologically).
  const timeline = (await sql`
    select
      s.id as session_id, s.status, s.lesson_id, s.created_at,
      l.title as lesson_title,
      c.id as course_id, c.title as course_title, c.subject as course_subject
    from sessions s
    join lessons l on l.id = s.lesson_id
    left join courses c on c.id = l.course_id
    where s.student_id = ${user.student_id}
    order by s.created_at asc
  `) as unknown as SessionTimelineRow[];

  // Load progression for the selected session's course (if any). One row
  // per (student × course); composed by the progression LLM call when the
  // student clicks Refresh on the ◆ Development sidebar.
  const courseIdForProgression =
    timeline.find((t) => t.session_id === sessionParam)?.course_id ??
    timeline[timeline.length - 1]?.course_id ??
    null;
  let progression: ProgressionRow | null = null;
  if (courseIdForProgression) {
    const progressionRows = (await sql`
      select derived_content, derived_at
      from progressions
      where student_id = ${user.student_id}
        and course_id = ${courseIdForProgression}
        and lesson_id is null
      limit 1
    `) as unknown as ProgressionRow[];
    progression = progressionRows[0] ?? null;
  }

  // Choose which session to render in the detail panel.
  const selected =
    timeline.find((t) => t.session_id === sessionParam) ??
    timeline[timeline.length - 1] ??
    null;

  // If we have a selection, fetch its lesson (for blocks) + substrate +
  // reading. Done sequentially because they're tiny queries.
  let lesson: LessonRow | null = null;
  let nodes: SubstrateNode[] = [];
  let reading: ReadingRow | null = null;
  if (selected) {
    const lessonRows = (await sql`
      select id, title, blocks
      from lessons where id = ${selected.lesson_id}
    `) as unknown as LessonRow[];
    lesson = lessonRows[0] ?? null;

    nodes = (await sql`
      select id, role, kind, content, status, created_at
      from nodes where session_id = ${selected.session_id}
      order by created_at asc
    `) as unknown as SubstrateNode[];

    const readingRows = (await sql`
      select derived_content
      from readings
      where student_id = ${user.student_id} and lesson_id = ${selected.lesson_id}
      limit 1
    `) as unknown as ReadingRow[];
    reading = readingRows[0] ?? null;
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
        title="Portfolio"
        subtitle={`${user.name}${selected?.course_subject ? ` · ${selected.course_subject}` : ""}`}
        backHref="/artifacts"
        backLabel="Your work"
        right={`${timeline.length} ${timeline.length === 1 ? "session" : "sessions"}`}
        user={user}
      />

      {timeline.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Timeline sidebar */}
          <aside
            style={{
              width: 224,
              borderRight: `1px solid ${tokens.color.border}`,
              background: tokens.color.panel,
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: "9px 16px",
                borderBottom: `1px solid ${tokens.color.border}`,
              }}
            >
              <span
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: tokens.color.ter,
                }}
              >
                Timeline
              </span>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {timeline.map((s) => {
                const active = selected?.session_id === s.session_id;
                const date = new Date(s.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <Link
                    key={s.session_id}
                    href={`/portfolio?session=${s.session_id}`}
                    style={{
                      display: "block",
                      padding: "12px 16px",
                      borderBottom: `1px solid ${tokens.color.border}`,
                      borderLeft: `2.5px solid ${active ? tokens.ai.label : "transparent"}`,
                      background: active ? tokens.ai.faint : "transparent",
                      textDecoration: "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: tokens.font.ui,
                          fontSize: 8.5,
                          color: tokens.color.ter,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {date}
                      </span>
                      <SessionTypeChip status={s.status} />
                    </div>
                    <div
                      style={{
                        fontFamily: tokens.font.body,
                        fontSize: 12,
                        color: active ? tokens.color.text : tokens.color.sec,
                        lineHeight: 1.45,
                      }}
                    >
                      {s.lesson_title}
                    </div>
                  </Link>
                );
              })}
            </div>

            {courseIdForProgression && (
              <div
                style={{
                  padding: "14px 16px",
                  borderTop: `1px solid ${tokens.color.border}`,
                  background: tokens.color.margin,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    gap: 6,
                  }}
                >
                  <SmallLabel color={tokens.ai.label}>
                    {tokens.aiMarker} Development
                  </SmallLabel>
                  <form action={composeProgression} style={{ display: "inline" }}>
                    <input
                      type="hidden"
                      name="course_id"
                      value={courseIdForProgression}
                    />
                    <button
                      type="submit"
                      title="Re-compose your development from your readings (~3-5s)."
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 8,
                        fontWeight: 700,
                        color: tokens.ai.label,
                        fontFamily: tokens.font.ui,
                        letterSpacing: "0.10em",
                        textTransform: "uppercase",
                        textDecoration: "underline",
                        padding: 0,
                      }}
                    >
                      Refresh →
                    </button>
                  </form>
                </div>
                <div
                  style={{
                    paddingLeft: 8,
                    borderLeft: `1.5px solid ${tokens.color.border}`,
                  }}
                >
                  {progression?.derived_content ? (
                    <ProgressionMoves content={progression.derived_content} />
                  ) : (
                    <p
                      style={{
                        fontFamily: tokens.font.body,
                        fontSize: 11,
                        fontStyle: "italic",
                        color: tokens.color.ter,
                        margin: 0,
                        lineHeight: 1.65,
                      }}
                    >
                      No development reading yet — click Refresh to compose one
                      from your readings across this course.
                    </p>
                  )}
                </div>

                {/* Drill-in to the full /progression view. Only surfaced
                    when there's a composition to read; the sidebar
                    summary above is the snapshot, the route is the
                    paragraph-level read. */}
                {progression?.derived_content && (
                  <Link
                    href={`/progression/${user.student_id}`}
                    style={{
                      display: "inline-block",
                      marginTop: 12,
                      paddingLeft: 8,
                      fontFamily: tokens.font.ui,
                      fontSize: 9,
                      fontWeight: 700,
                      color: tokens.ai.label,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      textDecoration: "underline",
                    }}
                  >
                    Open full view →
                  </Link>
                )}
              </div>
            )}
          </aside>

          {/* Session detail */}
          <section
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "32px 44px",
              background: tokens.color.canvas,
            }}
          >
            {selected && lesson && (
              <SessionDetail
                session={selected}
                lesson={lesson}
                nodes={nodes}
                reading={reading}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// ── session detail ───────────────────────────────────────────────────────

function SessionDetail({
  session,
  lesson,
  nodes,
  reading,
}: {
  session: SessionTimelineRow;
  lesson: LessonRow;
  nodes: SubstrateNode[];
  reading: ReadingRow | null;
}) {
  const blocks = lesson.blocks ?? [];
  const teacherProvided = blocks.filter((b) =>
    ["reading", "video", "ai_generated", "quiz"].includes(b.type),
  );
  const date = new Date(session.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  // Build student work cards from substrate. v0: a single "My argument" card
  // summarizing the latest live assertion + linking to the prior teacher
  // material in the same session.
  const liveAssertion =
    nodes.filter((n) => n.role === "assertion" && n.status === "open").pop() ??
    nodes.filter((n) => n.role === "assertion").pop() ??
    null;

  const supportingMove =
    nodes.filter((n) => n.role === "support" && n.status === "open").pop() ?? null;

  const studentWork: Array<{
    type: string;
    title: string;
    meta: string;
    content: string;
    links: string[];
  }> = [];

  if (liveAssertion) {
    studentWork.push({
      type: "Argument",
      title: "My argument",
      meta:
        session.status === "completed"
          ? "Written in session"
          : "In progress · live session",
      content: liveAssertion.content,
      links: teacherProvided
        .slice(0, 2)
        .map((b) => `↗ ${shorten(b.content, 32)}`),
    });
  }

  if (supportingMove && supportingMove.id !== liveAssertion?.id) {
    studentWork.push({
      type: "Supporting move",
      title: supportingMove.kind,
      meta: "Substrate",
      content: supportingMove.content,
      links: liveAssertion ? ["◇ My argument · " + date] : [],
    });
  }

  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 26,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 9,
            color: tokens.color.ter,
            letterSpacing: "0.04em",
          }}
        >
          {date}
        </span>
        <h1
          style={{
            fontFamily: tokens.font.body,
            fontSize: 22,
            fontStyle: "italic",
            fontWeight: 500,
            color: tokens.color.text,
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {session.lesson_title}
        </h1>
      </header>

      {teacherProvided.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <SectionDivider label={`${tokens.aiMarker} Provided`} color={tokens.ai.label} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {teacherProvided.map((b) => (
              <ACard
                key={b.id}
                title={prettyBlockTitle(b)}
                type={prettyBlockType(b.type)}
                meta={b.meta ?? ""}
                isTeacher
              />
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 28 }}>
        <SectionDivider label="Your work" />
        {studentWork.length > 0 ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {studentWork.map((s, i) => (
              <ACard
                key={i}
                title={s.title}
                type={s.type}
                meta={s.meta}
                content={s.content}
                links={s.links}
              />
            ))}
          </div>
        ) : (
          <p
            style={{
              fontFamily: tokens.font.body,
              fontSize: 13,
              fontStyle: "italic",
              color: tokens.color.ter,
              margin: 0,
              lineHeight: 1.7,
              padding: "16px 18px",
              border: `1px dashed ${tokens.color.border}`,
              borderRadius: 4,
              background: tokens.color.cardLight,
            }}
          >
            You haven&apos;t written anything in this session yet. Open the lesson to begin.
          </p>
        )}
      </section>

      {reading?.derived_content?.in_progress && (
        <div
          style={{
            paddingLeft: 12,
            borderLeft: `1.5px solid ${tokens.ai.border}`,
          }}
        >
          <SmallLabel color={tokens.ai.label}>{tokens.aiMarker} Observation</SmallLabel>
          <p
            style={{
              fontFamily: tokens.font.body,
              fontSize: 13.5,
              fontStyle: "italic",
              color: tokens.ai.text,
              margin: 0,
              lineHeight: 1.75,
            }}
          >
            {reading.derived_content.in_progress}
          </p>
        </div>
      )}
    </>
  );
}

// ── small components ────────────────────────────────────────────────────

// Render the four-move progression in the constrained sidebar. The full
// observational paragraphs live on /progression/[student_id]; here we
// foreground the WAS → SHIFT → NOW arc and treat recommended_next as a
// peripheral italic question. Anchors are suppressed in the sidebar to
// stay tight — the drill-in surface carries them.
function ProgressionMoves({ content }: { content: ProgressionContent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SidebarMove label="Earlier" prose={content.prior_state} />
      <SidebarMove label="The shift" prose={content.inflection_moment} />
      <SidebarMove label="Now" prose={content.current_state} />
      <div style={{ marginTop: 4 }}>
        <div
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: tokens.ai.label,
            marginBottom: 4,
          }}
        >
          {tokens.aiMarker} Next move
        </div>
        <p
          style={{
            fontFamily: tokens.font.body,
            fontSize: 11,
            fontStyle: "italic",
            color: tokens.ai.text,
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {content.recommended_next}
        </p>
      </div>
    </div>
  );
}

function SidebarMove({ label, prose }: { label: string; prose: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: tokens.color.ter,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 11,
          fontStyle: "italic",
          color: tokens.color.sec,
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        {prose}
      </p>
    </div>
  );
}

function ACard({
  title,
  type,
  meta,
  content,
  links,
  isTeacher,
}: {
  title: string;
  type: string;
  meta: string;
  content?: string;
  links?: string[];
  isTeacher?: boolean;
}) {
  return (
    <article
      style={{
        flex: "1 1 220px",
        padding: "13px 15px",
        border: `1px solid ${isTeacher ? tokens.ai.border : tokens.color.border}`,
        borderLeft: `2.5px solid ${isTeacher ? tokens.ai.border : tokens.color.border}`,
        borderRadius: "0 5px 5px 0",
        background: isTeacher ? tokens.ai.bg : tokens.color.panel,
        boxShadow: tokens.shadow,
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: isTeacher ? tokens.ai.label : tokens.color.ter,
          marginBottom: 4,
        }}
      >
        {type}
      </div>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          color: tokens.color.text,
          marginBottom: 4,
          fontStyle: isTeacher ? "italic" : "normal",
        }}
      >
        {title}
      </div>
      {content && (
        <p
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12,
            color: tokens.color.sec,
            margin: "4px 0 8px",
            lineHeight: 1.55,
          }}
        >
          {content}
        </p>
      )}
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 9,
          color: tokens.color.ter,
          letterSpacing: "0.04em",
          marginBottom: links && links.length > 0 ? 8 : 0,
        }}
      >
        {meta}
      </div>
      {links && links.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {links.map((link, i) => (
            <LinkChip key={i} text={link} />
          ))}
        </div>
      )}
    </article>
  );
}

function LinkChip({ text }: { text: string }) {
  const isPriorWork = text.startsWith("◇");
  return (
    <span
      title="Click-to-navigate not yet wired in v0"
      style={{
        fontFamily: tokens.font.body,
        fontSize: 10.5,
        fontStyle: "italic",
        padding: "3px 9px",
        borderRadius: 2,
        cursor: "default",
        border: `1px solid ${isPriorWork ? tokens.color.border : tokens.ai.border}`,
        background: isPriorWork ? tokens.color.canvas : tokens.ai.faint,
        color: isPriorWork ? tokens.color.sec : tokens.ai.text,
      }}
    >
      {text}
    </span>
  );
}

function SectionDivider({ label, color }: { label: string; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: color ?? tokens.color.ter,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 1,
          background: color ?? tokens.color.border,
          opacity: 0.6,
        }}
      />
    </div>
  );
}

function SmallLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontFamily: tokens.font.ui,
        fontSize: 8,
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

function SessionTypeChip({ status }: { status: "active" | "completed" }) {
  const isActive = status === "active";
  return (
    <span
      style={{
        fontFamily: tokens.font.ui,
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "1px 6px",
        borderRadius: 2,
        color: isActive ? tokens.color.flagLabel : tokens.ai.label,
        border: `1px solid ${isActive ? tokens.color.flagBd : tokens.ai.border}`,
        background: isActive ? tokens.color.flagBg : tokens.ai.bg,
      }}
    >
      {isActive ? "active" : "complete"}
    </span>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 36px",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          textAlign: "center",
          padding: "40px 32px",
          background: tokens.color.cardLight,
          border: `1px dashed ${tokens.color.border}`,
          borderRadius: 6,
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
          No portfolio yet.
        </h2>
        <p
          style={{
            fontFamily: tokens.font.body,
            fontSize: 14,
            fontStyle: "italic",
            color: tokens.color.sec,
            margin: "0 0 20px",
            lineHeight: 1.7,
          }}
        >
          Sessions you start in your enrolled lessons will appear here as a
          timeline. Each session collects the materials your teacher provided
          and the work you produced.
        </p>
        <Link
          href="/artifacts"
          style={{
            display: "inline-block",
            padding: "9px 18px",
            background: tokens.ai.label,
            color: tokens.ai.bg,
            fontFamily: tokens.font.ui,
            fontSize: 10,
            fontWeight: 700,
            border: "none",
            borderRadius: 4,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Open your work →
        </Link>
      </div>
    </div>
  );
}


// ── helpers ──────────────────────────────────────────────────────────────

function prettyBlockType(t: LessonBlock["type"]): string {
  switch (t) {
    case "reading":
      return "Source";
    case "video":
      return "Video";
    case "ai_generated":
      return "AI Generated";
    case "quiz":
      return "Quiz";
    case "context":
      return "Context";
    case "prompt":
      return "Prompt";
    case "response":
      return "Response";
  }
}

function prettyBlockTitle(b: LessonBlock): string {
  // Prefer the source line for readings, otherwise truncate the content
  // to a card-friendly first phrase.
  if (b.source && b.source.length < 80) return b.source;
  return shorten(b.content, 70);
}

function shorten(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}
