// Lesson block content schemas.
//
// The lesson block envelope { id, type, content, meta?, source? } keeps the
// existing locked type enum (context, reading, video, prompt, response,
// ai_generated, quiz). What changes is the shape of `content` per type:
//
//   - reading.content   →  Doc = { segments: Segment[] }    (rich doc)
//   - video.content     →  VideoContent { url, provider, ... }
//   - everything else   →  string (unchanged)
//
// Segment.kind is the closed structural axis (locked at 'human' | 'ai').
// Provenance is structural — the schema makes "AI hides what it wrote"
// impossible. Within kind='ai', sub_kind discriminates paragraph / chart /
// diagram (locked because the renderer is exhaustive over them).
//
// Data provenance on charts (DataSource.kind) is also closed, with a
// REQUIRED caveat when the AI proposed data from topic. The schema makes
// "AI silently asserts data" structurally impossible.
//
// Vega-Lite specs are constrained to a narrow allow-list (see
// ./vega-allowlist) — full Vega-Lite is huge and emitting arbitrary specs
// risks bizarre or broken visualizations.

import { z } from "zod";
import { VegaLiteSpecSchema } from "./vega-allowlist";

// ── Generation metadata ───────────────────────────────────────────────
//
// Server-set on insert. Never accepted from the LLM (the structuredCall
// flow returns the body; the server attaches generation metadata). Audit
// trail: which prompt produced what segment, when, with which model.

export const GenerationMetaSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().min(1),
  generated_at: z.string().min(1), // ISO 8601
});
export type GenerationMeta = z.infer<typeof GenerationMetaSchema>;

// ── Chart data provenance ─────────────────────────────────────────────
//
// Closed three-kind enum. ai_proposed_from_topic REQUIRES a caveat string
// — the LLM cannot dress invented data as authoritative because the schema
// won't let it. The renderer always shows provenance to the reader.

export const DataSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("teacher_supplied"),
    raw_input: z.string().min(1),
  }),
  z.object({
    kind: z.literal("ai_extracted_from_text"),
    source_text: z.string().min(1),
    source_text_origin: z.enum(["reading", "attachment", "pasted"]),
  }),
  z.object({
    kind: z.literal("ai_proposed_from_topic"),
    topic_brief: z.string().min(1),
    caveat: z.string().min(1),
  }),
]);
export type DataSource = z.infer<typeof DataSourceSchema>;

// ── Diagram nodes/edges ───────────────────────────────────────────────
//
// Mirrors the substrate's locked-role + open-kind discipline. Diagram is
// teacher source material, NOT substrate — but the structural vocabulary
// is intentionally shared so concept maps in source material use the same
// shapes students learn to think in.

export const DiagramNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.string().min(1), // open descriptor (e.g. "actor", "mechanism", "outcome")
});
export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramEdgeSchema = z.object({
  src: z.string().min(1),
  dst: z.string().min(1),
  relation: z.enum(["positive", "negative", "depends"]), // closed; same as substrate
  kind: z.string().min(1), // open ("causes", "qualifies", "presupposes")
});
export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

// ── Segment — the atom of a long-form reading doc ─────────────────────
//
// kind ∈ {human, ai} is the closed structural axis (provenance is locked).
// Within kind='ai', sub_kind is the closed renderer-exhaustion discriminator.
// Everything else is content fields shaped per sub_kind.

const HumanSegmentSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("human"),
  body: z.string(),
});

const AIParagraphSegmentSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("ai"),
  sub_kind: z.literal("paragraph"),
  body: z.string().min(1),
  generation: GenerationMetaSchema,
});

const AIChartSegmentSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("ai"),
  sub_kind: z.literal("chart"),
  chart_spec: VegaLiteSpecSchema,
  data: z.array(z.record(z.string(), z.unknown())).min(1),
  data_source: DataSourceSchema,
  caption: z.string().min(1),
  generation: GenerationMetaSchema,
});

const AIDiagramSegmentSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("ai"),
  sub_kind: z.literal("diagram"),
  nodes: z.array(DiagramNodeSchema).min(1),
  edges: z.array(DiagramEdgeSchema),
  caption: z.string().min(1),
  generation: GenerationMetaSchema,
});

export const SegmentSchema = z.union([
  HumanSegmentSchema,
  AIParagraphSegmentSchema,
  AIChartSegmentSchema,
  AIDiagramSegmentSchema,
]);
export type Segment = z.infer<typeof SegmentSchema>;
export type HumanSegment = z.infer<typeof HumanSegmentSchema>;
export type AIParagraphSegment = z.infer<typeof AIParagraphSegmentSchema>;
export type AIChartSegment = z.infer<typeof AIChartSegmentSchema>;
export type AIDiagramSegment = z.infer<typeof AIDiagramSegmentSchema>;

// AI-only union — used for the ai_generated block's content. That block
// type is by definition AI-authored; allowing a human segment would
// contradict its own name. (If the teacher wants to write prose, they
// have the reading block; ai_generated is specifically for AI-authored
// standalone widgets.)
export const AISegmentSchema = z.union([
  AIParagraphSegmentSchema,
  AIChartSegmentSchema,
  AIDiagramSegmentSchema,
]);
export type AISegment = z.infer<typeof AISegmentSchema>;

// AI segment shape WITHOUT the generation metadata. This is what the LLM
// emits; the server attaches `generation` before persisting. Splitting the
// types this way structurally prevents the LLM from forging an audit trail.

export const LLMEmittedAIParagraphSchema = AIParagraphSegmentSchema.omit({
  generation: true,
  id: true,
});
export const LLMEmittedAIChartSchema = AIChartSegmentSchema.omit({
  generation: true,
  id: true,
});
export const LLMEmittedAIDiagramSchema = AIDiagramSegmentSchema.omit({
  generation: true,
  id: true,
});

export const LLMEmittedAISegmentSchema = z.discriminatedUnion("sub_kind", [
  LLMEmittedAIParagraphSchema,
  LLMEmittedAIChartSchema,
  LLMEmittedAIDiagramSchema,
]);
export type LLMEmittedAISegment = z.infer<typeof LLMEmittedAISegmentSchema>;

// ── Doc — the rich-reading content shape ──────────────────────────────

export const DocSchema = z.object({
  segments: z.array(SegmentSchema),
});
export type Doc = z.infer<typeof DocSchema>;

// ── AIGeneratedContent — the structured ai_generated block shape ────
//
// One AI segment per ai_generated block. Wrapped in an object so the
// "no content yet" state is explicit (segment: null) rather than relying
// on truthiness of a possibly-empty union. The block IS the segment;
// regenerating replaces the whole thing.

export const AIGeneratedContentSchema = z.object({
  segment: AISegmentSchema.nullable(),
});
export type AIGeneratedContent = z.infer<typeof AIGeneratedContentSchema>;

// ── VideoContent — the structured video block shape ───────────────────
//
// `url` is intentionally allowed to be empty: that is the stub state for a
// freshly-added video block (teacher clicked "+ Video", hasn't pasted a
// link yet). VideoPlayer renders empty-url as a placeholder pill; the
// composer's URL field renders as empty input. Enforcing min(1) here would
// make the very first read after addBlockToLesson throw.

export const VideoContentSchema = z.object({
  url: z.string(),
  provider: z.enum(["youtube", "vimeo", "mp4"]),
  start_s: z.number().int().nonnegative().optional(),
  end_s: z.number().int().nonnegative().optional(),
  transcript: z.string().optional(),
  // Optional AI summary — same shape as an AI paragraph segment. Carries
  // the ◆ marker structurally; the renderer treats it as AI-authored.
  ai_summary: AIParagraphSegmentSchema.optional(),
});
export type VideoContent = z.infer<typeof VideoContentSchema>;

// ── Block envelope ────────────────────────────────────────────────────
//
// The lesson's blocks[] array is a sequence of these. Type is the locked
// 7-value enum (preserves graph-traversal-like queries elsewhere). Content
// shape varies per type — the polymorphism is enforced at the server-action
// validation boundary, not at this top-level schema (jsonb is shape-loose
// in Postgres; type-narrowing happens when we read into TS).

export const BlockTypeSchema = z.enum([
  "context",
  "reading",
  "video",
  "prompt",
  "response",
  "ai_generated",
  "quiz",
]);
export type BlockType = z.infer<typeof BlockTypeSchema>;

// Top-level Block. Content is typed as unknown here because each block
// type narrows it to a different schema — see `parseBlock` below.
export const BlockSchema = z.object({
  id: z.string().min(1),
  type: BlockTypeSchema,
  content: z.unknown(),
  meta: z.string().optional(),
  source: z.string().optional(),
});
export type Block = z.infer<typeof BlockSchema>;

// Narrowed block — `content` is typed per `type`. Use this when you've
// validated and want full type safety on content fields.
export type TypedBlock =
  | { id: string; type: "context"; content: string; meta?: string; source?: string }
  | { id: string; type: "reading"; content: Doc; meta?: string; source?: string }
  | { id: string; type: "video"; content: VideoContent; meta?: string; source?: string }
  | { id: string; type: "prompt"; content: string; meta?: string; source?: string }
  | { id: string; type: "response"; content: string; meta?: string; source?: string }
  | { id: string; type: "ai_generated"; content: AIGeneratedContent; meta?: string; source?: string }
  | { id: string; type: "quiz"; content: string; meta?: string; source?: string };

// Validate and narrow a single Block. Throws ZodError on shape mismatch.
export function parseBlock(input: unknown): TypedBlock {
  const top = BlockSchema.parse(input);
  switch (top.type) {
    case "reading": {
      const content = DocSchema.parse(top.content);
      return { ...top, type: "reading", content };
    }
    case "video": {
      const content = VideoContentSchema.parse(top.content);
      return { ...top, type: "video", content };
    }
    case "ai_generated": {
      const content = AIGeneratedContentSchema.parse(top.content);
      return { ...top, type: "ai_generated", content };
    }
    case "context":
    case "prompt":
    case "response":
    case "quiz": {
      const content = z.string().parse(top.content);
      return { ...top, type: top.type, content };
    }
  }
}

export function parseBlocks(input: unknown): TypedBlock[] {
  const arr = z.array(z.unknown()).parse(input);
  return arr.map((b) => parseBlock(b));
}
