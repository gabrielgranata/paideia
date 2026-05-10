"use client";

// NodeView for aiChart segments. Thin TipTap wrapper around the shared
// AIChartFigure renderer — same JSX used in the ai_generated block
// editor, so chart presentation stays in one place.

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { tokens } from "@/lib/design/tokens";
import { AIChartFigure } from "../segment-renderers/AIChartFigure";
import type { AIChartSegment } from "@/lib/lesson-blocks";

export function ChartSegmentView({ node, deleteNode }: NodeViewProps) {
  const segment = node.attrs.segment as AIChartSegment | null;

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
          Chart segment missing data.
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      contentEditable={false}
      data-segment-kind="ai-chart"
      style={{ margin: "14px 0" }}
    >
      <AIChartFigure segment={segment} onRemove={() => deleteNode()} />
    </NodeViewWrapper>
  );
}
