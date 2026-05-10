// Editor ↔ Doc serialization.
//
// The TipTap document and our Doc/Segment shape are kept in 1:1
// correspondence at the top level — each top-level TipTap node is one
// Segment. This file is the boundary; everything inside the editor uses
// TipTap's content model, everything outside (DB, API, server actions)
// uses Doc.
//
// Discipline: never mutate generation/data_source metadata on a round-trip.
// Editor serialization preserves the AI segment's authoring stamp exactly.
//
// Top-level mapping:
//   - paragraph (TipTap default)        → { kind: 'human', body: text }
//   - aiParagraph (custom block)        → { kind: 'ai', sub_kind: 'paragraph', ... }
//   - aiChart (custom atom)             → { kind: 'ai', sub_kind: 'chart',    ... }
//   - aiDiagram (custom atom)           → { kind: 'ai', sub_kind: 'diagram',  ... }

import type {
  Doc,
  Segment,
  AIParagraphSegment,
  AIChartSegment,
  AIDiagramSegment,
  HumanSegment,
} from "@/lib/lesson-blocks";

// Browser-side id minter. crypto.randomUUID is widely available now;
// fall back to Math.random for the few environments that lack it.
function segId(): string {
  const r =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(16).slice(2);
  return `seg_${r.slice(0, 8)}`;
}

type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
};

// Concatenate TipTap inline text. We only support plain text in this
// version — bold/italic/etc. survive in the editor but are flattened on
// save, since our Segment.body is a plain string. Future spec can grow
// the Segment shape if rich inline formatting becomes load-bearing.
function nodeText(node: TipTapNode): string {
  if (node.text) return node.text;
  if (!node.content) return "";
  return node.content.map(nodeText).join("");
}

export function editorJsonToDoc(json: unknown): Doc {
  const root = json as TipTapNode | undefined;
  if (!root || root.type !== "doc" || !root.content) {
    return { segments: [] };
  }
  const segments: Segment[] = [];
  for (const child of root.content) {
    const seg = nodeToSegment(child);
    if (seg) segments.push(seg);
  }
  return { segments };
}

function nodeToSegment(node: TipTapNode): Segment | null {
  switch (node.type) {
    case "paragraph": {
      const body = nodeText(node);
      const hs: HumanSegment = {
        id: (node.attrs?.id as string) || segId(),
        kind: "human",
        body,
      };
      return hs;
    }
    case "aiParagraph": {
      const segmentAttr = node.attrs?.segment as
        | Omit<AIParagraphSegment, "id"> & { id?: string }
        | undefined;
      // The body can be edited inline (we use editable: true on the node
      // view). Pull the current text from content; trust attrs for the
      // generation stamp.
      const body = nodeText(node);
      if (!segmentAttr?.generation) return null;
      const out: AIParagraphSegment = {
        id: segmentAttr.id ?? (node.attrs?.id as string) ?? segId(),
        kind: "ai",
        sub_kind: "paragraph",
        body: body || segmentAttr.body || "",
        generation: segmentAttr.generation,
      };
      return out;
    }
    case "aiChart": {
      const segmentAttr = node.attrs?.segment as
        | Omit<AIChartSegment, "id"> & { id?: string }
        | undefined;
      if (!segmentAttr) return null;
      const out: AIChartSegment = {
        id: segmentAttr.id ?? (node.attrs?.id as string) ?? segId(),
        kind: "ai",
        sub_kind: "chart",
        chart_spec: segmentAttr.chart_spec,
        data: segmentAttr.data,
        data_source: segmentAttr.data_source,
        caption: segmentAttr.caption,
        generation: segmentAttr.generation,
      };
      return out;
    }
    case "aiDiagram": {
      const segmentAttr = node.attrs?.segment as
        | Omit<AIDiagramSegment, "id"> & { id?: string }
        | undefined;
      if (!segmentAttr) return null;
      const out: AIDiagramSegment = {
        id: segmentAttr.id ?? (node.attrs?.id as string) ?? segId(),
        kind: "ai",
        sub_kind: "diagram",
        nodes: segmentAttr.nodes,
        edges: segmentAttr.edges,
        caption: segmentAttr.caption,
        generation: segmentAttr.generation,
      };
      return out;
    }
    default:
      return null;
  }
}

export function docToEditorContent(doc: Doc): TipTapNode {
  return {
    type: "doc",
    content:
      doc.segments.length === 0
        ? [{ type: "paragraph" }]
        : doc.segments.map(segmentToNode),
  };
}

function segmentToNode(seg: Segment): TipTapNode {
  if (seg.kind === "human") {
    return {
      type: "paragraph",
      attrs: { id: seg.id },
      content: seg.body ? [{ type: "text", text: seg.body }] : undefined,
    };
  }
  if (seg.sub_kind === "paragraph") {
    return {
      type: "aiParagraph",
      attrs: { id: seg.id, segment: seg },
      content: seg.body ? [{ type: "text", text: seg.body }] : undefined,
    };
  }
  if (seg.sub_kind === "chart") {
    return {
      type: "aiChart",
      attrs: { id: seg.id, segment: seg },
    };
  }
  return {
    type: "aiDiagram",
    attrs: { id: seg.id, segment: seg },
  };
}
