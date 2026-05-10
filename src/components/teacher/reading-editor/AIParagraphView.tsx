"use client";

// NodeView for aiParagraph segments. The body is editable inline (the
// teacher can refine the AI's prose), but the ◆ provenance stripe and
// the generation metadata are NOT editable from this view. Provenance
// is structural; the teacher accepting / refining the AI's output keeps
// the audit trail intact.

import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { tokens } from "@/lib/design/tokens";
import type { AIParagraphSegment } from "@/lib/lesson-blocks";

export function AIParagraphView({ node, deleteNode }: NodeViewProps) {
  const segment = node.attrs.segment as Partial<AIParagraphSegment> | null;
  const generatedAt = segment?.generation?.generated_at
    ? new Date(segment.generation.generated_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "unknown";

  return (
    <NodeViewWrapper
      data-segment-kind="ai-paragraph"
      style={{
        position: "relative",
        margin: "10px 0",
        padding: "10px 14px 12px",
        borderLeft: `2px solid ${tokens.color.border}`,
        background: tokens.color.margin,
        borderRadius: "0 3px 3px 0",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: tokens.color.ter,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontFamily: tokens.font.ui,
          }}
        >
          {tokens.aiMarker} AI paragraph
        </span>
        <span
          style={{
            fontSize: 8,
            color: tokens.color.faint,
            letterSpacing: "0.06em",
            fontFamily: tokens.font.ui,
          }}
        >
          · {generatedAt}
        </span>
        <button
          type="button"
          onClick={() => deleteNode()}
          contentEditable={false}
          style={{
            marginLeft: "auto",
            fontSize: 8,
            color: tokens.color.faint,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: tokens.font.ui,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: 0,
          }}
          title="Remove this AI segment"
        >
          ✕ Remove
        </button>
      </header>

      <NodeViewContent
        style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: tokens.color.sec,
          fontStyle: "italic",
          fontFamily: tokens.font.body,
        }}
      />
    </NodeViewWrapper>
  );
}
