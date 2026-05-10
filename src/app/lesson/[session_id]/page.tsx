import { notFound } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import QuestionPrompt from "@/components/a2ui/QuestionPrompt";
import MaterialsRail, {
  type RailBlock,
} from "@/components/lesson/MaterialsRail";
import AnnotationsRail from "@/components/lesson/AnnotationsRail";
import ExploreSurface from "@/components/lesson/ExploreSurface";

// The lesson session — exploration surface. Three columns:
//
//   Materials (left rail)   |   Question + Writing (center)   |   AI Observations (right rail)
//
// Student writing is the foreground: a single large EB Garamond surface
// with three modes (Notes / Draft / Reflection), each persisting its own
// text. The AI's structural observations accumulate quietly in the right
// rail — never inside the writing, never modal. Materials sit on the left
// for reference, collapsed by default.

type Session = {
  id: string;
  status: "active" | "completed";
  student_id: string;
  lesson_id: string;
  working_text: { notes?: string; draft?: string; reflection?: string } | null;
};

type LessonBlock = {
  id: string;
  type:
    | "context"
    | "reading"
    | "video"
    | "prompt"
    | "response"
    | "ai_generated"
    | "quiz";
  content: unknown;
  meta?: string;
  source?: string;
};

type Lesson = {
  id: string;
  title: string;
  prompt: string;
  reasoning_shape: string | null;
  source_material_text: string | null;
  blocks: LessonBlock[] | null;
};

type Turn = {
  id: string;
  created_at: Date;
  next_gap: { prompt: string; target_node_ids: string[]; type: string } | null;
};

export default async function LessonPage({
  params,
}: {
  params: Promise<{ session_id: string }>;
}) {
  await requireRole("student");
  const { session_id } = await params;

  const sessionRows = (await sql`
    select id, status, student_id, lesson_id, working_text
    from sessions
    where id = ${session_id}
  `) as unknown as Session[];
  const session = sessionRows[0];
  if (!session) notFound();

  const lessonRows = (await sql`
    select id, title, prompt, reasoning_shape, source_material_text, blocks
    from lessons
    where id = ${session.lesson_id}
  `) as unknown as Lesson[];
  const lesson = lessonRows[0];
  if (!lesson) notFound();

  const blocks: LessonBlock[] = lesson.blocks ?? [];
  const contextBlock = blocks.find((b) => b.type === "context");
  const materialBlocks = blocks.filter(
    (b) =>
      b.type === "reading" ||
      b.type === "video" ||
      b.type === "ai_generated" ||
      b.type === "quiz",
  ) as RailBlock[];

  const turns = (await sql`
    select id, created_at, next_gap
    from turns
    where session_id = ${session_id}
    order by created_at desc
    limit 50
  `) as unknown as Turn[];

  // Has the student actually written enough for the artifact composer to
  // have something to organize? We check for substrate nodes — a turn
  // without an extracted node is shape we don't want to compose from.
  const substrateCountRows = (await sql`
    select count(*)::int as n from nodes where session_id = ${session_id}
  `) as unknown as Array<{ n: number }>;
  const hasSubstrate = (substrateCountRows[0]?.n ?? 0) > 0;

  const contextText = asString(contextBlock?.content).trim();
  const wt = session.working_text ?? {};
  const initialNotes = typeof wt.notes === "string" ? wt.notes : "";
  const initialDraft = typeof wt.draft === "string" ? wt.draft : "";
  const initialReflection =
    typeof wt.reflection === "string" ? wt.reflection : "";

  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

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
        title="Lesson"
        subtitle={`${lesson.title} · ${date}`}
        right={lesson.reasoning_shape ?? undefined}
      >
        <Link
          href="/artifacts"
          style={{
            fontSize: 10,
            color: tokens.color.ter,
            fontFamily: tokens.font.ui,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textDecoration: "none",
            opacity: 0.8,
          }}
        >
          ← Back
        </Link>
      </Chrome>

      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
        }}
      >
        <MaterialsRail blocks={materialBlocks} />

        {/* Center column — Question + writing surface. */}
        <section
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            padding: "28px 44px 24px",
            overflowY: "auto",
          }}
        >
          <QuestionPrompt
            question={lesson.prompt}
            target_node_ids={[]}
            gap_type="lesson-prompt"
          />

          {contextText && (
            <p
              style={{
                marginTop: -10,
                marginBottom: 22,
                fontFamily: tokens.font.body,
                fontSize: 13,
                fontStyle: "italic",
                color: tokens.color.sec,
                lineHeight: 1.7,
                paddingLeft: 12,
                borderLeft: `2px solid ${tokens.color.border}`,
              }}
            >
              {contextText}
            </p>
          )}

          <ExploreSurface
            sessionId={session.id}
            lessonId={lesson.id}
            lessonTitle={lesson.title}
            hasSubstrate={hasSubstrate}
            initialNotes={initialNotes}
            initialDraft={initialDraft}
            initialReflection={initialReflection}
          />
        </section>

        <AnnotationsRail turns={turns} />
      </div>
    </div>
  );
}

function asString(c: unknown): string {
  return typeof c === "string" ? c : "";
}
