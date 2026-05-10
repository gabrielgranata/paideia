"use client";

// NodeView for aiDiagram segments. Thin TipTap wrapper around the shared
// AIDiagramFigure renderer.

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { tokens } from "@/lib/design/tokens";
import { AIDiagramFigure } from "../segment-renderers/AIDiagramFigure";
import type { AIDiagramSegment } from "@/lib/lesson-blocks";

export function DiagramSegmentView({ node, deleteNode }: NodeViewProps) {
  const segment = node.attrs.segment as AIDiagramSegment | null;

  if (!segment) {
    return (
      <NodeViewWrapper>
        <div
          style={{
            padding: 12,
            border: `1px dashed ${tokens.color.border}`,
            background: tokens.color.margin,
            color: tokens.color.ter,
            fontFamily: tokens.font.ui,
            fontSize: 11,
          }}
        >
          Diagram segment missing data.
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      contentEditable={false}
      data-segment-kind="ai-diagram"
      style={{ margin: "14px 0" }}
    >
      <AIDiagramFigure segment={segment} onRemove={() => deleteNode()} />
    </NodeViewWrapper>
  );
}
