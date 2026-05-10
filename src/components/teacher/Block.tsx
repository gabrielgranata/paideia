import { tokens } from "@/lib/design/tokens";
import {
  saveBlockContent,
  saveTeacherNote,
  saveVideoUrl,
  type Block as BlockData,
  type BlockType,
} from "@/app/actions/teacher";
import type { Doc } from "@/lib/lesson-blocks";
import VideoPlayer from "@/components/video/VideoPlayer";
import { TeacherNoteSlot } from "./TeacherNoteSlot";
import { AIGeneratedBlockEditor } from "./AIGeneratedBlockEditor";
import { AIChartFigure } from "./segment-renderers/AIChartFigure";
import { AIDiagramFigure } from "./segment-renderers/AIDiagramFigure";

// Block — one row in the teacher's lesson composer.
//
// Two modes:
//
//  - "plan": the teacher's authoring view. Card-bordered, light cream
//    surface, type badge + meta line + inline-editable content (form
//    posts to saveBlockContent), then a dashed-bordered private teacher
//    note container below (form posts to saveTeacherNote). The dashed
//    container is the only place teacher-private prose is allowed.
//
//  - "preview-student": render the block exactly as the student would
//    see it in their lesson session. No teacher notes, no edit
//    affordances, no completion affordances. Position carries the
//    territory: AI-authored material reads italic with ◆; student
//    response reads upright in main-column tone with no marker.
//
// Authorship-territory invariants:
//  - The ◆ marker only appears on AI-authored / teacher-selected-AI
//    blocks (context, prompt, ai_generated). The student-response block
//    has no marker — the page is theirs by default.
//  - In preview-student mode, no completion affordance renders. The
//    teacher is a privileged viewer of their own private layer; the
//    student-facing portion of preview must mirror /lesson/[session_id].
//
// Server actions (form-action pattern) keep edits server-rendered: the
// teacher saves a block or a note, the server writes through, the page
// revalidates. No client state, no useTransition — just <form action>.

type BlockMode = "plan" | "preview-student";

const BADGE: Record<
  BlockType,
  { label: string; isAI: boolean; isPrivate: false }
> = {
  // Context is teacher-authored framing prose. It lives in AI-territory
  // (left margin in preview, italic) because it's scaffolding rather than
  // the lesson's central question — but the AUTHORSHIP is the teacher's,
  // so no ◆ marker. Margin position carries the "scaffolding" signal on
  // its own.
  context: { label: "Context", isAI: false, isPrivate: false },
  reading: { label: "Reading", isAI: false, isPrivate: false },
  video: { label: "Video / Transcript", isAI: false, isPrivate: false },
  prompt: { label: "◆ Prompt", isAI: true, isPrivate: false },
  response: { label: "Response", isAI: false, isPrivate: false },
  ai_generated: {
    label: "◆ AI Generated · teacher-selected",
    isAI: true,
    isPrivate: false,
  },
  quiz: { label: "Quiz", isAI: false, isPrivate: false },
};

type BlockProps = {
  block: BlockData;
  mode: BlockMode;
  teacherNote?: string;
  lessonId: string;
  // ai_generated needs the lesson framing to call the composer. Optional
  // because not every block type uses it.
  lessonTitle?: string;
  lessonPrompt?: string;
};

export default function Block({
  block,
  mode,
  teacherNote,
  lessonId,
  lessonTitle,
  lessonPrompt,
}: BlockProps) {
  if (mode === "preview-student") {
    return <PreviewBlock block={block} />;
  }
  return (
    <PlanBlock
      block={block}
      teacherNote={teacherNote}
      lessonId={lessonId}
      lessonTitle={lessonTitle}
      lessonPrompt={lessonPrompt}
    />
  );
}

// ── Plan mode ─────────────────────────────────────────────────────────

function PlanBlock({
  block,
  teacherNote,
  lessonId,
  lessonTitle,
  lessonPrompt,
}: {
  block: BlockData;
  teacherNote?: string;
  lessonId: string;
  lessonTitle?: string;
  lessonPrompt?: string;
}) {
  // Reading and video blocks carry structured content (Doc / VideoContent);
  // their plan-mode editors live in dedicated components. The textarea-based
  // editor below operates only on string-content block types.
  if (block.type === "reading") {
    return (
      <PlanReadingBlock
        block={block}
        teacherNote={teacherNote}
        lessonId={lessonId}
      />
    );
  }
  if (block.type === "video") {
    return (
      <PlanVideoBlock
        block={block}
        teacherNote={teacherNote}
        lessonId={lessonId}
      />
    );
  }
  if (block.type === "ai_generated") {
    return (
      <PlanAIGeneratedBlock
        block={block}
        teacherNote={teacherNote}
        lessonId={lessonId}
        lessonTitle={lessonTitle ?? ""}
        lessonPrompt={lessonPrompt ?? ""}
      />
    );
  }

  const badge = BADGE[block.type];
  // After the reading/video early returns above, the remaining block
  // types (context / prompt / response / ai_generated / quiz) all carry
  // string content. Narrow at the use site since BlockData's content
  // union still includes the structured shapes.
  const stringContent =
    typeof block.content === "string" ? block.content : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* The block content card — light cream on canvas. */}
      <article
        style={{
          border: `1px solid ${tokens.color.border}`,
          borderRadius: 3,
          padding: "11px 16px",
          background: tokens.color.cardLight,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 7,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: tokens.color.ter,
              background: tokens.color.margin,
              border: `1px solid ${tokens.color.border}`,
              padding: "2px 9px",
              fontFamily: tokens.font.ui,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              borderRadius: 10,
            }}
          >
            {badge.label}
          </span>
          {block.meta && (
            <span
              style={{
                fontSize: 10,
                color: tokens.color.ter,
                fontFamily: tokens.font.body,
                fontStyle: "italic",
                marginLeft: "auto",
              }}
            >
              {block.meta}
            </span>
          )}
        </header>

        <form action={saveBlockContent}>
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="blockId" value={block.id} />
          <textarea
            name="content"
            defaultValue={stringContent}
            rows={Math.max(2, Math.ceil((stringContent?.length ?? 0) / 80))}
            style={{
              width: "100%",
              padding: "8px 0",
              fontSize: 13,
              lineHeight: 1.6,
              color: tokens.color.text,
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: tokens.font.body,
              fontStyle: "normal",
              resize: "vertical",
            }}
          />
          {block.source && (
            <p
              style={{
                fontSize: 10,
                color: tokens.color.faint,
                fontStyle: "italic",
                fontFamily: tokens.font.body,
                margin: "0 0 6px",
              }}
            >
              Source: {block.source}
            </p>
          )}
          <div
            style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}
          >
            <button
              type="submit"
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: tokens.color.text,
                background: "transparent",
                border: "none",
                fontFamily: tokens.font.ui,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                padding: "2px 0",
              }}
            >
              Save
            </button>
          </div>
        </form>
      </article>

      <TeacherNoteSlot
        lessonId={lessonId}
        blockId={block.id}
        teacherNote={teacherNote}
      />
    </div>
  );
}

// ── Preview-student mode ──────────────────────────────────────────────
//
// Each block type renders as a student would see it inside their lesson
// session. The territory map applies: AI lives in margin tone with the ◆
// marker; student territory has no marker; teacher voice does not appear.
// The composer mirrors /lesson/[session_id] for these block types.

function PreviewBlock({ block }: { block: BlockData }) {
  switch (block.type) {
    case "context":
      // Context is teacher-authored framing. Margin position + italic
      // body do the "scaffolding, not the question" work spatially; no
      // ◆ marker because the teacher is the author.
      return (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: tokens.color.ter,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              marginBottom: 7,
              fontFamily: tokens.font.ui,
            }}
          >
            Context
          </div>
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.75,
              color: tokens.color.sec,
              fontStyle: "italic",
              fontFamily: tokens.font.body,
              margin: 0,
              paddingLeft: 10,
              borderLeft: `1.5px solid ${tokens.color.border}`,
            }}
          >
            {block.content}
          </p>
        </div>
      );

    case "reading":
      // Long-form reading doc. Preview flattens segments to inline prose
      // with the ◆ marker on AI segments. The actual student-facing reader
      // (with charts/diagrams/interactive provenance) is built in a later
      // spec when we add A2UI components for rich-reading rendering.
      return (
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: tokens.color.ter,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 8,
              fontFamily: tokens.font.ui,
            }}
          >
            Reading
          </div>
          <ReadingPreview doc={block.content} />
          {block.meta && (
            <div
              style={{
                marginTop: 6,
                fontSize: 10,
                color: tokens.color.faint,
                fontFamily: tokens.font.body,
                fontStyle: "italic",
              }}
            >
              {block.meta}
            </div>
          )}
        </div>
      );

    case "video":
      return (
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: tokens.color.ter,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 8,
              fontFamily: tokens.font.ui,
            }}
          >
            Clip
          </div>
          <VideoPlayer content={block.content} title={block.meta} />
        </div>
      );

    case "ai_generated":
      // The student-facing preview of an ai_generated block. The block
      // carries one AI segment (paragraph / chart / diagram). The
      // segment renders with the same shared figures used in the
      // teacher composer, so the student sees exactly what the teacher
      // approved. Empty (no segment yet) renders as a faint placeholder
      // — the preview shouldn't crash if the teacher hasn't generated
      // anything yet.
      return (
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: tokens.color.ter,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              marginBottom: 7,
              fontFamily: tokens.font.ui,
            }}
          >
            {tokens.aiMarker} AI Generated · teacher-selected ·{" "}
            <span style={{ color: tokens.color.faint }}>not student work</span>
          </div>
          {block.content.segment === null ? (
            <p
              style={{
                fontSize: 12,
                color: tokens.color.ter,
                fontStyle: "italic",
                fontFamily: tokens.font.body,
                margin: 0,
                lineHeight: 1.65,
              }}
            >
              (Empty AI-generated block — teacher hasn&apos;t generated content yet.)
            </p>
          ) : block.content.segment.sub_kind === "paragraph" ? (
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.65,
                color: tokens.color.sec,
                fontStyle: "italic",
                fontFamily: tokens.font.body,
                margin: 0,
                paddingLeft: 10,
                borderLeft: `1.5px solid ${tokens.color.border}`,
              }}
            >
              {block.content.segment.body}
            </p>
          ) : block.content.segment.sub_kind === "chart" ? (
            <AIChartFigure segment={block.content.segment} />
          ) : (
            <AIDiagramFigure segment={block.content.segment} />
          )}
          {block.source && (
            <p
              style={{
                fontSize: 10,
                color: tokens.color.faint,
                fontStyle: "italic",
                fontFamily: tokens.font.body,
                margin: "6px 0 0",
              }}
            >
              Source: {block.source}
            </p>
          )}
        </div>
      );

    case "prompt":
      // Rendered as the student's question at the head of the writing
      // surface. DM Serif Display italic, ◆ Question label.
      return (
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 8,
              fontWeight: 600,
              color: tokens.color.ter,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 10,
              fontFamily: tokens.font.ui,
            }}
          >
            {tokens.aiMarker} Question
          </div>
          <p
            style={{
              fontFamily: tokens.font.display,
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 26,
              lineHeight: 1.36,
              color: tokens.color.text,
              margin: "0 0 22px",
            }}
          >
            {block.content}
          </p>
          <div style={{ height: 1, background: tokens.color.border }} />
        </div>
      );

    case "response":
      return (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 8,
              fontWeight: 600,
              color: tokens.color.ter,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 10,
              fontFamily: tokens.font.ui,
            }}
          >
            Your response
          </div>
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
      );

    case "quiz":
      return (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: tokens.color.ter,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 8,
              fontFamily: tokens.font.ui,
            }}
          >
            Quiz
          </div>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: tokens.color.text,
              fontFamily: tokens.font.body,
              margin: 0,
            }}
          >
            {block.content}
          </p>
        </div>
      );
  }
}

// ── Reading & video block sub-components ──────────────────────────────
//
// Phase-2 stubs: the schema is in place but the rich editors land in
// later phases. PlanReadingBlock shows a "Edit reading" affordance that
// will open the TipTap editor (Phase 6); PlanVideoBlock shows a small
// structured form for url/provider/timestamps (Phase 8 fleshes out the
// player). The preview components flatten structured content to plain
// text for now.

function PlanReadingBlock({
  block,
  teacherNote,
  lessonId,
}: {
  block: Extract<BlockData, { type: "reading" }>;
  teacherNote?: string;
  lessonId: string;
}) {
  const segmentCount = block.content.segments.length;
  const aiCount = block.content.segments.filter((s) => s.kind === "ai").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <article
        style={{
          border: `1px solid ${tokens.color.border}`,
          borderRadius: 3,
          padding: "11px 16px",
          background: tokens.color.cardLight,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 7,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: tokens.color.ter,
              background: tokens.color.margin,
              border: `1px solid ${tokens.color.border}`,
              padding: "2px 9px",
              fontFamily: tokens.font.ui,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              borderRadius: 10,
            }}
          >
            Reading · long-form
          </span>
          <span
            style={{
              fontSize: 10,
              color: tokens.color.ter,
              fontFamily: tokens.font.body,
              fontStyle: "italic",
              marginLeft: "auto",
            }}
          >
            {segmentCount === 0
              ? "empty"
              : `${segmentCount} segment${segmentCount === 1 ? "" : "s"}`}
            {aiCount > 0 && ` · ${aiCount} AI`}
          </span>
        </header>

        {segmentCount === 0 ? (
          <p
            style={{
              fontSize: 12,
              color: tokens.color.ter,
              fontStyle: "italic",
              fontFamily: tokens.font.body,
              margin: 0,
              lineHeight: 1.65,
            }}
          >
            No content yet. Open the editor to write the reading or insert
            AI-generated segments.
          </p>
        ) : (
          <ReadingPreview doc={block.content} compact />
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <a
            href={`/teacher/lessons/${lessonId}/reading/${block.id}`}
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: tokens.color.text,
              fontFamily: tokens.font.ui,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Open editor →
          </a>
        </div>
      </article>

      <TeacherNoteSlot
        lessonId={lessonId}
        blockId={block.id}
        teacherNote={teacherNote}
      />
    </div>
  );
}

function PlanAIGeneratedBlock({
  block,
  teacherNote,
  lessonId,
  lessonTitle,
  lessonPrompt,
}: {
  block: Extract<BlockData, { type: "ai_generated" }>;
  teacherNote?: string;
  lessonId: string;
  lessonTitle: string;
  lessonPrompt: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <AIGeneratedBlockEditor
        lessonId={lessonId}
        blockId={block.id}
        lessonTitle={lessonTitle}
        lessonPrompt={lessonPrompt}
        initialSegment={block.content.segment}
      />
      <TeacherNoteSlot
        lessonId={lessonId}
        blockId={block.id}
        teacherNote={teacherNote}
      />
    </div>
  );
}

function PlanVideoBlock({
  block,
  teacherNote,
  lessonId,
}: {
  block: Extract<BlockData, { type: "video" }>;
  teacherNote?: string;
  lessonId: string;
}) {
  const v = block.content;
  const hasUrl = v.url.trim().length > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <article
        style={{
          border: `1px solid ${tokens.color.border}`,
          borderRadius: 3,
          padding: "11px 16px",
          background: tokens.color.cardLight,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 7,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: tokens.color.ter,
              background: tokens.color.margin,
              border: `1px solid ${tokens.color.border}`,
              padding: "2px 9px",
              fontFamily: tokens.font.ui,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              borderRadius: 10,
            }}
          >
            Video · {v.provider}
          </span>
          {v.ai_summary && (
            <span
              style={{
                fontSize: 9,
                color: tokens.color.ter,
                fontFamily: tokens.font.ui,
                letterSpacing: "0.04em",
                marginLeft: "auto",
              }}
            >
              {tokens.aiMarker} summary attached
            </span>
          )}
        </header>

        {hasUrl && (
          <div style={{ marginBottom: 10 }}>
            <VideoPlayer content={v} title={block.meta} />
          </div>
        )}

        <form action={saveVideoUrl}>
          <input type="hidden" name="lessonId" value={lessonId} />
          <input type="hidden" name="blockId" value={block.id} />
          <input
            type="url"
            name="url"
            defaultValue={v.url}
            placeholder="https://www.youtube.com/watch?v=…"
            style={{
              width: "100%",
              padding: "6px 0",
              fontSize: 12,
              color: tokens.color.text,
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${tokens.color.border}`,
              outline: "none",
              fontFamily: tokens.font.body,
            }}
          />
          <div
            style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}
          >
            <button
              type="submit"
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: tokens.color.text,
                background: "transparent",
                border: "none",
                fontFamily: tokens.font.ui,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                padding: "2px 0",
              }}
            >
              Save
            </button>
          </div>
        </form>
      </article>

      <TeacherNoteSlot
        lessonId={lessonId}
        blockId={block.id}
        teacherNote={teacherNote}
      />
    </div>
  );
}

// Flatten a Doc to inline prose. AI segments carry the ◆ marker and read
// italic so authorship stays visible even in compact previews.
function ReadingPreview({ doc, compact }: { doc: Doc; compact?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? 6 : 10,
      }}
    >
      {doc.segments.map((s) => {
        if (s.kind === "human") {
          return (
            <p
              key={s.id}
              style={{
                fontSize: compact ? 12 : 14,
                lineHeight: 1.7,
                color: tokens.color.text,
                fontFamily: tokens.font.body,
                margin: 0,
              }}
            >
              {s.body}
            </p>
          );
        }
        if (s.sub_kind === "paragraph") {
          return (
            <p
              key={s.id}
              style={{
                fontSize: compact ? 12 : 14,
                lineHeight: 1.7,
                color: tokens.color.sec,
                fontStyle: "italic",
                fontFamily: tokens.font.body,
                margin: 0,
                paddingLeft: 10,
                borderLeft: `1.5px solid ${tokens.color.border}`,
              }}
            >
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: tokens.color.ter,
                  letterSpacing: "0.12em",
                  marginRight: 6,
                  fontFamily: tokens.font.ui,
                  fontStyle: "normal",
                }}
              >
                {tokens.aiMarker} AI
              </span>
              {s.body}
            </p>
          );
        }
        // chart / diagram — full renderer comes in Phase 7. Show caption
        // for now so the planner already reflects that these segments exist.
        const label = s.sub_kind === "chart" ? "AI chart" : "AI diagram";
        return (
          <div
            key={s.id}
            style={{
              fontSize: compact ? 11 : 12,
              color: tokens.color.ter,
              fontStyle: "italic",
              fontFamily: tokens.font.body,
              padding: "6px 10px",
              border: `1px dashed ${tokens.color.border}`,
              background: tokens.color.margin,
              borderRadius: 3,
            }}
          >
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: tokens.color.ter,
                letterSpacing: "0.12em",
                marginRight: 6,
                fontFamily: tokens.font.ui,
                fontStyle: "normal",
              }}
            >
              {tokens.aiMarker} {label}
            </span>
            {s.caption}
          </div>
        );
      })}
    </div>
  );
}

