import { tokens } from "@/lib/design/tokens";
import DocRenderer from "@/components/lesson/DocRenderer";
import VideoPlayer from "@/components/video/VideoPlayer";
import type { Doc, VideoContent } from "@/lib/lesson-blocks";

// MaterialsRail — collapsible left rail listing the teacher-authored
// materials (readings, videos, AI-generated artifacts, quizzes). Each
// item shows its source / meta line by default; the body opens inline
// via native <details>, so no client JS is required for the rail itself.
//
// The rail is a peripheral surface — the writing area is the foreground.
// We use small ui labels and quiet borders. When a material is expanded,
// it visually extends down without pushing the writing column.

export type RailBlock = {
  id: string;
  type: "reading" | "video" | "ai_generated" | "quiz";
  content: unknown;
  meta?: string;
  source?: string;
};

export default function MaterialsRail({ blocks }: { blocks: RailBlock[] }) {
  if (blocks.length === 0) {
    return (
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          padding: "20px 18px",
          borderRight: `1px solid ${tokens.color.border}`,
          background: tokens.color.canvas,
        }}
      >
        <RailLabel>Materials</RailLabel>
        <p
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12,
            fontStyle: "italic",
            color: tokens.color.ter,
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          This lesson has no materials yet.
        </p>
      </aside>
    );
  }
  return (
    <aside
      aria-label="Lesson materials"
      style={{
        width: 240,
        flexShrink: 0,
        padding: "20px 18px",
        borderRight: `1px solid ${tokens.color.border}`,
        background: tokens.color.canvas,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <RailLabel>Materials</RailLabel>
      {blocks.map((b) => (
        <MaterialItem key={b.id} block={b} />
      ))}
    </aside>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function MaterialItem({ block }: { block: RailBlock }) {
  const title = headlineFor(block);
  const badge = badgeFor(block.type);
  return (
    <details
      style={{
        borderLeft: `2px solid ${tokens.color.border}`,
        paddingLeft: 10,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 8,
            fontWeight: 700,
            color: tokens.color.ter,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            display: "block",
            marginBottom: 3,
          }}
        >
          {badge}
        </span>
        <span
          style={{
            fontFamily: tokens.font.body,
            fontSize: 13,
            fontStyle: "italic",
            color: tokens.color.text,
            lineHeight: 1.45,
          }}
        >
          {title}
        </span>
        {block.source && (
          <span
            style={{
              display: "block",
              marginTop: 3,
              fontFamily: tokens.font.body,
              fontSize: 10.5,
              fontStyle: "italic",
              color: tokens.color.ter,
              lineHeight: 1.45,
            }}
          >
            ↗ {block.source}
          </span>
        )}
      </summary>
      <div style={{ paddingTop: 10 }}>
        <MaterialBody block={block} />
      </div>
    </details>
  );
}

function MaterialBody({ block }: { block: RailBlock }) {
  switch (block.type) {
    case "reading": {
      const doc = asDocContent(block.content);
      if (doc) return <DocRenderer doc={doc} />;
      return <Prose text={asString(block.content)} />;
    }
    case "video": {
      const video = asVideoContent(block.content);
      if (video) return <VideoPlayer content={video} title={block.meta} />;
      return (
        <p style={{ ...proseStyle, fontStyle: "italic", color: tokens.color.ter }}>
          No video link.
        </p>
      );
    }
    case "ai_generated":
      return (
        <div
          style={{
            paddingLeft: 12,
            borderLeft: `2px solid ${tokens.ai.border}`,
          }}
        >
          <div
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 8,
              fontWeight: 700,
              color: tokens.ai.label,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {tokens.aiMarker} AI Generated · teacher-selected
          </div>
          <Prose text={asString(block.content)} italic colored />
        </div>
      );
    case "quiz":
      return (
        <>
          <Prose text={asString(block.content)} italic />
          <p
            style={{
              fontFamily: tokens.font.body,
              fontSize: 11,
              fontStyle: "italic",
              color: tokens.color.ter,
              margin: "8px 0 0",
              lineHeight: 1.6,
            }}
          >
            Answer in your notes — the system will read it when you save.
          </p>
        </>
      );
  }
}

const proseStyle = {
  fontFamily: tokens.font.body,
  fontSize: 13,
  lineHeight: 1.7,
  color: tokens.color.text,
  margin: 0,
  whiteSpace: "pre-wrap" as const,
};

function Prose({
  text,
  italic,
  colored,
}: {
  text: string;
  italic?: boolean;
  colored?: boolean;
}) {
  return (
    <p
      style={{
        ...proseStyle,
        fontStyle: italic ? "italic" : "normal",
        color: colored ? tokens.ai.text : tokens.color.text,
      }}
    >
      {text}
    </p>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function headlineFor(block: RailBlock): string {
  if (block.source && block.source.length < 70) return block.source;
  if (block.meta && block.meta.length < 70) return block.meta;
  switch (block.type) {
    case "reading":
      return "Reading";
    case "video":
      return "Video";
    case "ai_generated":
      return "AI-generated";
    case "quiz":
      return "Quiz";
  }
}

function badgeFor(type: RailBlock["type"]): string {
  switch (type) {
    case "reading":
      return "Source";
    case "video":
      return "Video";
    case "ai_generated":
      return `${tokens.aiMarker} AI generated`;
    case "quiz":
      return "Quiz";
  }
}

function asString(c: unknown): string {
  return typeof c === "string" ? c : "";
}

function asDocContent(c: unknown): Doc | null {
  if (c && typeof c === "object" && !Array.isArray(c)) {
    const segs = (c as { segments?: unknown }).segments;
    if (Array.isArray(segs)) return c as Doc;
  }
  return null;
}

function asVideoContent(c: unknown): VideoContent | null {
  if (c && typeof c === "object" && !Array.isArray(c)) {
    const obj = c as Record<string, unknown>;
    if (typeof obj.url === "string" && typeof obj.provider === "string") {
      return c as VideoContent;
    }
  }
  return null;
}
