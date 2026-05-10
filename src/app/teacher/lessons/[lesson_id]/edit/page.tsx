import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { addBlockToLesson } from "@/app/actions/teacher";
import Link from "next/link";
import { sql } from "@/lib/db";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import MarginPanel from "@/components/a2ui/MarginPanel";
import MainColumn from "@/components/a2ui/MainColumn";
import MLabel from "@/components/a2ui/MLabel";
import ColLabel from "@/components/a2ui/ColLabel";
import QuestionPrompt from "@/components/a2ui/QuestionPrompt";
import Block from "@/components/teacher/Block";
import { SortableBlockList } from "@/components/teacher/SortableBlockList";
import { ChatPanel } from "@/components/teacher/ChatPanel";
import { DeleteLessonButton } from "@/components/teacher/DeleteLessonButton";
import type { Block as BlockData, BlockType, TeacherNotes } from "@/app/actions/teacher";
import { parseOrMigrateBlocks } from "@/lib/lesson-blocks";
import type { ChatMessage } from "@/lib/llm/teacher-lesson-chat";

// Lesson Composer — /teacher/lessons/[lesson_id]/edit
//
// One scope: the teacher authoring a lesson. Two modes, toggled by a
// single search param so the surface stays server-rendered:
//
//   ?mode=preview  → student-facing preview, with the teacher's private
//                    notes in a third column on the right ("not visible
//                    to student"). The middle column must look exactly
//                    like /lesson/[session_id] would render — the preview
//                    is what the student will actually see.
//
//   (default)      → Plan View. Sidebar lesson summary + numbered block
//                    list on the left; the block composer (block cards
//                    + dashed-bordered private notes) in the main area;
//                    inert add-affordances at the foot.
//
// Boundary: nothing on this page calls any LLM. Everything reads/writes
// Postgres directly. Add-block / generate-content affordances are inert
// in v0 — render visibly but carry a TODO comment instead of a handler.

type LessonRow = {
  id: string;
  title: string;
  prompt: string;
  source_material_text: string | null;
  blocks: unknown; // jsonb — narrow via parseOrMigrateBlocks below.
  teacher_notes: TeacherNotes | null;
  course_id: string | null;
  course_title: string | null;
  course_subject: string | null;
  enrolled_count: number;
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lesson_id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await requireRole("teacher");
  const { lesson_id } = await params;
  const { mode: modeParam } = await searchParams;
  const mode: "plan" | "preview" =
    modeParam === "preview" ? "preview" : "plan";

  const rows = (await sql`
    select
      l.id, l.title, l.prompt, l.source_material_text, l.blocks, l.teacher_notes,
      l.course_id,
      c.title as course_title,
      c.subject as course_subject,
      coalesce(
        (select count(*)::int from course_enrollments where course_id = l.course_id),
        0
      ) as enrolled_count
    from lessons l
    left join courses c on c.id = l.course_id
    where l.id = ${lesson_id}
  `) as unknown as LessonRow[];
  const lesson = rows[0];
  if (!lesson) notFound();

  // Defensively migrate any legacy block shapes (string content for
  // reading/video) before rendering. parseOrMigrateBlocks is idempotent
  // for already-migrated blocks.
  const blocks: BlockData[] = parseOrMigrateBlocks(lesson.blocks);
  const notes: TeacherNotes = lesson.teacher_notes ?? {};

  // Lesson-chat thread for this teacher × lesson. Hardcoded teacher id
  // matches the v0 seed; replace when real auth lands.
  const chatRows = (await sql`
    select messages
    from teacher_chats
    where teacher_id = 'teacher_k' and lesson_id = ${lesson_id}
  `) as unknown as Array<{ messages: ChatMessage[] | null }>;
  const chatHistory: ChatMessage[] = chatRows[0]?.messages ?? [];

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
        title="Lesson Composer"
        subtitle={lesson.title}
        backHref="/teacher"
        backLabel="Class"
        right={
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <DeleteLessonButton
              lessonId={lesson_id}
              lessonTitle={lesson.title}
            />
            <span
              style={{
                fontSize: 10,
                color: tokens.color.ter,
                padding: "5px 14px",
                border: `1px solid ${tokens.color.border}`,
                background: tokens.color.margin,
                fontFamily: tokens.font.ui,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "default",
              }}
              // TODO: PUBLISH LESSON action — inert in v0.
              title="Publish flow not yet wired"
            >
              Publish lesson
            </span>
          </span>
        }
        user={user}
      >
        <ModeToggle lessonId={lesson_id} mode={mode} />
      </Chrome>

      <div
        style={{
          flex: 1,
          display: "flex",
          padding: "18px 20px",
          gap: 16,
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            borderRadius: 5,
            overflow: "hidden",
            boxShadow: tokens.shadow,
            background: tokens.color.cardLight,
          }}
        >
          {mode === "preview" ? (
            <PreviewMode lesson={lesson} blocks={blocks} notes={notes} />
          ) : (
            <PlanMode
              lessonId={lesson_id}
              lesson={lesson}
              blocks={blocks}
              notes={notes}
            />
          )}
        </div>
        {/* Right-side lesson chat — teacher-only, plan mode only. The
            preview mode simulates the student surface, where this panel
            would be a fidelity violation. */}
        {mode === "plan" && (
          <div
            style={{
              borderRadius: 5,
              overflow: "hidden",
              boxShadow: tokens.shadow,
              display: "flex",
            }}
          >
            <ChatPanel
              lessonId={lesson_id}
              initialHistory={chatHistory}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mode toggle ───────────────────────────────────────────────────────
// Two <Link> controls in the chrome. Active one is underlined
// typographically — no color, no fill. Pure URL state, no client.

function ModeToggle({
  lessonId,
  mode,
}: {
  lessonId: string;
  mode: "plan" | "preview";
}) {
  const base = `/teacher/lessons/${lessonId}/edit`;
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <ToggleLink href={base} active={mode === "plan"}>
        Plan view
      </ToggleLink>
      <ToggleLink href={`${base}?mode=preview`} active={mode === "preview"}>
        Preview →
      </ToggleLink>
    </div>
  );
}

function ToggleLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        fontSize: 10,
        color: active ? tokens.color.text : tokens.color.ter,
        fontFamily: tokens.font.ui,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        textDecoration: active ? "underline" : "none",
        textUnderlineOffset: 4,
        textDecorationThickness: 1,
        opacity: active ? 1 : 0.75,
      }}
    >
      {children}
    </Link>
  );
}

// ── Plan mode ─────────────────────────────────────────────────────────
//
// Left margin (200px): lesson summary + block list (overview / nav).
// Main column: vertical block list with a 1px timeline gutter (5px dot +
// connector). Add-affordances row at the bottom (inert, TODO).

function PlanMode({
  lessonId,
  lesson,
  blocks,
  notes,
}: {
  lessonId: string;
  lesson: LessonRow;
  blocks: BlockData[];
  notes: TeacherNotes;
}) {
  return (
    <>
      <MarginPanel width={200}>
        <ColLabel>Lesson</ColLabel>
        <div
          style={{
            fontSize: 14,
            color: tokens.color.text,
            marginBottom: 4,
            fontFamily: tokens.font.display,
            fontStyle: "italic",
            lineHeight: 1.4,
          }}
        >
          {lesson.title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: tokens.color.ter,
            marginBottom: 24,
            fontFamily: tokens.font.body,
            lineHeight: 1.5,
          }}
        >
          {lesson.course_title ?? "No course"}
          {lesson.course_subject && ` · ${lesson.course_subject}`}
          <br />
          {lesson.enrolled_count} {lesson.enrolled_count === 1 ? "student" : "students"} enrolled
        </div>
        <ColLabel>Blocks</ColLabel>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {blocks.map((b, i) => (
            <div
              key={b.id}
              style={{
                fontSize: 11,
                color: tokens.color.sec,
                padding: "6px 0",
                borderBottom: `1px solid ${tokens.color.border}`,
                display: "flex",
                gap: 8,
                alignItems: "baseline",
                fontFamily: tokens.font.body,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: tokens.color.faint,
                  fontFamily: tokens.font.ui,
                  letterSpacing: "0.08em",
                  minWidth: 14,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ flex: 1 }}>{labelFor(b.type)}</span>
            </div>
          ))}
        </div>
      </MarginPanel>

      <div
        style={{
          flex: 1,
          background: tokens.color.card,
          padding: "28px 36px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {/* Drag-reorder + delete are owned by SortableBlockList (client).
            Each block's editor body stays a server component — the client
            wrapper only adds the drag handle, delete button, and the
            dnd-kit plumbing. */}
        <SortableBlockList
          lessonId={lessonId}
          blocks={blocks.map((b) => ({ id: b.id, label: labelFor(b.type) }))}
        >
          {blocks.map((b) => (
            <Block
              key={b.id}
              block={b}
              mode="plan"
              teacherNote={notes[b.id]}
              lessonId={lessonId}
              lessonTitle={lesson.title}
              lessonPrompt={lesson.prompt}
            />
          ))}
        </SortableBlockList>

        {/* Add-affordances. Each is a one-button form posting to
            addBlockToLesson with the block type. The action appends a
            stub block to the lesson and revalidates this page so the
            new block lands in the list immediately. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            paddingLeft: 21,
            marginTop: 6,
          }}
        >
          {(
            [
              { type: "context", label: "+ Context" },
              { type: "reading", label: "+ Reading" },
              { type: "video", label: "+ Video" },
              { type: "prompt", label: "+ Prompt" },
              { type: "quiz", label: "+ Quiz" },
              { type: "ai_generated", label: "+ ◆ AI Generated" },
            ] as Array<{ type: BlockType; label: string }>
          ).map(({ type, label }) => (
            <form key={type} action={addBlockToLesson} style={{ display: "inline" }}>
              <input type="hidden" name="lessonId" value={lessonId} />
              <input type="hidden" name="type" value={type} />
              <button
                type="submit"
                style={{
                  fontSize: 10,
                  color: tokens.color.ter,
                  padding: "5px 12px",
                  borderRadius: 3,
                  border: `1px dashed ${tokens.color.border}`,
                  fontFamily: tokens.font.ui,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  background: "transparent",
                }}
              >
                {label}
              </button>
            </form>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Preview mode ──────────────────────────────────────────────────────
//
// Three columns. The left two mirror what the student sees in their
// /lesson/[session_id]; the right column belongs to the teacher and is
// labeled "not visible to student". The right column never renders on
// the student-facing route — preview is the only place the teacher gets
// to see both layers at once.

function PreviewMode({
  lesson,
  blocks,
  notes,
}: {
  lesson: LessonRow;
  blocks: BlockData[];
  notes: TeacherNotes;
}) {
  const contextBlock = blocks.find((b) => b.type === "context");
  const promptBlock = blocks.find((b) => b.type === "prompt");
  const readingBlocks = blocks.filter((b) => b.type === "reading");
  const videoBlocks = blocks.filter((b) => b.type === "video");
  const aiGeneratedBlocks = blocks.filter((b) => b.type === "ai_generated");
  const quizBlocks = blocks.filter((b) => b.type === "quiz");

  // Annotated blocks for the right column. Order follows the canonical
  // block order; only blocks with a non-empty teacher_note appear.
  const annotated = blocks.filter((b) => (notes[b.id] ?? "").trim().length > 0);

  return (
    <>
      {/* Left margin — Context + Think out loud (mirrors student session) */}
      <MarginPanel width={200}>
        {contextBlock ? (
          <>
            <MLabel>Context</MLabel>
            <p
              style={{
                fontSize: 11,
                lineHeight: 1.75,
                color: tokens.color.sec,
                margin: 0,
                fontStyle: "italic",
                fontFamily: tokens.font.body,
                paddingLeft: 10,
                borderLeft: `1.5px solid ${tokens.color.border}`,
                marginBottom: 14,
              }}
            >
              {contextBlock.content}
            </p>
          </>
        ) : (
          <>
            <MLabel>Context</MLabel>
            <p
              style={{
                fontSize: 11,
                lineHeight: 1.75,
                color: tokens.color.ter,
                fontStyle: "italic",
                fontFamily: tokens.font.body,
                margin: "0 0 14px",
              }}
            >
              No context block on this lesson yet.
            </p>
          </>
        )}

        <div
          style={{
            height: 1,
            background: tokens.color.border,
            margin: "14px 0",
          }}
        />

        <MLabel>{tokens.aiMarker} Think out loud</MLabel>
        <p
          style={{
            fontSize: 11,
            color: tokens.color.ter,
            fontStyle: "italic",
            fontFamily: tokens.font.body,
            margin: 0,
            lineHeight: 1.65,
          }}
        >
          (empty in preview — student starts the conversation by writing)
        </p>
      </MarginPanel>

      {/* Main column — what the student sees: question + readings/AI +
          response area. Mirrors /lesson/[session_id] for the prompt and
          response shape. */}
      <MainColumn>
        {promptBlock ? (
          <QuestionPrompt
            question={promptBlock.content || lesson.prompt}
            target_node_ids={[]}
            gap_type="opening prompt"
          />
        ) : (
          <QuestionPrompt
            question={lesson.prompt}
            target_node_ids={[]}
            gap_type="opening prompt"
          />
        )}

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column" }}>
          {readingBlocks.map((b) => (
            <Block
              key={b.id}
              block={b}
              mode="preview-student"
              lessonId={lesson.id}
            />
          ))}
          {videoBlocks.map((b) => (
            <Block
              key={b.id}
              block={b}
              mode="preview-student"
              lessonId={lesson.id}
            />
          ))}
          {aiGeneratedBlocks.map((b) => (
            <Block
              key={b.id}
              block={b}
              mode="preview-student"
              lessonId={lesson.id}
            />
          ))}
          {quizBlocks.map((b) => (
            <Block
              key={b.id}
              block={b}
              mode="preview-student"
              lessonId={lesson.id}
            />
          ))}
        </div>

        <div style={{ marginTop: 8 }}>
          <ColLabel>Your response</ColLabel>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.9,
              color: tokens.color.ter,
              margin: 0,
              fontStyle: "italic",
              fontFamily: tokens.font.body,
            }}
          >
            Begin by writing what you think.
          </p>
        </div>
      </MainColumn>

      {/* Right margin — teacher's private notes. Marked clearly as not
          visible to the student. This column never appears on
          /lesson/[session_id]; it's a preview-only privileged view of
          the teacher's own private layer. */}
      <aside
        style={{
          width: 220,
          background: tokens.color.margin,
          borderLeft: `1px solid ${tokens.color.border}`,
          padding: "26px 18px 22px 20px",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: tokens.color.faint,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 14,
            fontFamily: tokens.font.ui,
          }}
        >
          Not visible to student
        </div>
        {annotated.length === 0 ? (
          <p
            style={{
              fontSize: 11,
              color: tokens.color.ter,
              fontStyle: "italic",
              fontFamily: tokens.font.body,
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            No private notes on this lesson yet. Add notes per block in
            Plan view.
          </p>
        ) : (
          annotated.map((b, i) => (
            <div
              key={b.id}
              style={{
                paddingTop: i === 0 ? 0 : 12,
                marginTop: i === 0 ? 0 : 12,
                borderTop:
                  i === 0 ? "none" : `1px solid ${tokens.color.border}`,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: tokens.color.ter,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: 5,
                  fontFamily: tokens.font.ui,
                }}
              >
                {labelFor(b.type)}
              </div>
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: tokens.color.sec,
                  fontStyle: "italic",
                  fontFamily: tokens.font.body,
                  margin: 0,
                }}
              >
                {notes[b.id]}
              </p>
            </div>
          ))
        )}
      </aside>
    </>
  );
}

// Small helper — block-type → human label, used in the sidebar list and
// in the right-column note headers. Kept here (not exported from Block)
// because Block's BADGE map carries presentation styling (background,
// borders) that the sidebar doesn't want.
function labelFor(t: BlockData["type"]): string {
  switch (t) {
    case "context":
      return "Context";
    case "reading":
      return "Reading";
    case "video":
      return "Video / Transcript";
    case "prompt":
      return "◆ Prompt";
    case "response":
      return "Response";
    case "ai_generated":
      return "◆ AI Generated";
    case "quiz":
      return "Quiz";
  }
}
