// Custom TipTap extensions for the reading editor.
//
// Three custom block nodes, all rendered via React NodeViews so the
// in-editor presentation matches what the student will see in the
// reading (provenance markers, italic body, chart/diagram visualization):
//
//   - aiParagraph: editable inline AI prose with a ◆ provenance stripe
//   - aiChart: ATOM rendering of a Vega-Lite chart + data_source label
//   - aiDiagram: ATOM rendering of a typed node/edge concept map
//
// All three carry their full Segment data in the `segment` attribute
// (and `id` mirrored for selection). On save, the serializer reads the
// attribute and hands it back as-is — the generation stamp, chart spec,
// diagram nodes/edges all survive the round-trip without loss.
//
// IMPORTANT: editing a human segment NEVER produces an AI segment, and
// editing an AI segment does NOT mutate its generation stamp. The
// extensions don't expose any command for "convert human to AI" or
// "edit generation metadata" — provenance only changes via the explicit
// "insert generated segment" flow that goes through the API route.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AIParagraphView } from "./AIParagraphView";
import { ChartSegmentView } from "./ChartSegmentView";
import { DiagramSegmentView } from "./DiagramSegmentView";
import type {
  AIParagraphSegment,
  AIChartSegment,
  AIDiagramSegment,
} from "@/lib/lesson-blocks";

export const AIParagraphExtension = Node.create({
  name: "aiParagraph",
  group: "block",
  content: "inline*",
  // We allow inline editing — the teacher can refine the AI output. The
  // body content changes but `segment.generation` does NOT, so the audit
  // trail still names the prompt that produced the original draft.
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      id: { default: null },
      segment: { default: null as null | Partial<AIParagraphSegment> },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-segment-kind="ai-paragraph"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-segment-kind": "ai-paragraph" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AIParagraphView);
  },
});

export const AIChartExtension = Node.create({
  name: "aiChart",
  group: "block",
  atom: true, // not editable inline; opens a side panel for spec edits
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      id: { default: null },
      segment: { default: null as null | Partial<AIChartSegment> },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-segment-kind="ai-chart"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-segment-kind": "ai-chart" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartSegmentView);
  },
});

export const AIDiagramExtension = Node.create({
  name: "aiDiagram",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      id: { default: null },
      segment: { default: null as null | Partial<AIDiagramSegment> },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-segment-kind="ai-diagram"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-segment-kind": "ai-diagram" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DiagramSegmentView);
  },
});
