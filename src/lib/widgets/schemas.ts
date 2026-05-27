// Student-composable widget catalog.
//
// The original A2UI catalog (ComposedNarrative / QuestionPrompt /
// ArtifactCard / ArtifactGrid / SourceReference) was AI-emitted only —
// the student couldn't add to it. Notion-style notes change that: the
// student composes by stacking widgets the system also knows how to
// emit.
//
// Authorship discipline still holds. Each widget has an `authored_by`
// field — `student` or `ai`. The renderer signals authorship by
// position + ◆ marker; the schema makes it impossible to forge (AI
// widgets carry generation metadata; student widgets do not).
//
// The locked widget vocabulary for v0:
//
//   text          — plain prose. Student or AI-authored.
//   quote         — an excerpt with optional source attribution.
//   source_ref    — a citation chip (the design's ↗) pointing at a
//                   lesson block, substrate node, prior artifact, or memory.
//   divider       — visual separator between sections.
//   ai_observation — AI-emitted noticing/question. NEVER a conclusion.
//                    Carries generation metadata + cites.
//
// Adding a widget type means: (1) add to the discriminated union,
// (2) add to the renderer switch, (3) extend any composer prompts that
// can emit it. The compiler will catch missing renderer cases.

import { z } from "zod";
import { GenerationMetaSchema } from "@/lib/lesson-blocks";
import { ArtifactReferenceSchema, type ArtifactReference } from "@/lib/artifacts/schemas";

// ── shared ──

export const WidgetIdSchema = z.string().min(1);

export const AuthorshipSchema = z.enum(["student", "ai"]);
export type Authorship = z.infer<typeof AuthorshipSchema>;

// ── widget types ──

export const TextWidgetSchema = z.object({
  id: WidgetIdSchema,
  type: z.literal("text"),
  authored_by: z.literal("student"),
  body: z.string(),
});
export type TextWidget = z.infer<typeof TextWidgetSchema>;

export const QuoteWidgetSchema = z.object({
  id: WidgetIdSchema,
  type: z.literal("quote"),
  authored_by: z.literal("student"),
  body: z.string(),
  // Free-form attribution (e.g., "Hebergam, 1832 testimony"). For
  // structured citation, use a separate source_ref widget.
  source: z.string().optional(),
});
export type QuoteWidget = z.infer<typeof QuoteWidgetSchema>;

// `ref` uses `z.lazy()` to defer reading `ArtifactReferenceSchema` until
// validation time. Turbopack was inlining widgets/schemas + artifacts/schemas
// into the same chunk and emitting them in the wrong order, causing a TDZ
// on `ArtifactReferenceSchema` during module init. z.lazy() breaks the
// init-time dependency without changing runtime semantics.
export const SourceRefWidgetSchema = z.object({
  id: WidgetIdSchema,
  type: z.literal("source_ref"),
  authored_by: z.literal("student"),
  ref: z.lazy(() => ArtifactReferenceSchema) as z.ZodType<ArtifactReference>,
  // Optional one-line note from the student about why they're citing.
  note: z.string().optional(),
});
export type SourceRefWidget = z.infer<typeof SourceRefWidgetSchema>;

export const DividerWidgetSchema = z.object({
  id: WidgetIdSchema,
  type: z.literal("divider"),
  authored_by: z.literal("student"),
});
export type DividerWidget = z.infer<typeof DividerWidgetSchema>;

// AI-emitted observation. NEVER a conclusion — only noticings + questions.
// The generation metadata is required so the renderer can show provenance
// and the schema can't be forged into a fake authorship.
export const AIObservationWidgetSchema = z.object({
  id: WidgetIdSchema,
  type: z.literal("ai_observation"),
  authored_by: z.literal("ai"),
  // The observation itself — should be a noticing or a question, never
  // a substantive claim. Enforced at the prompt level, not the schema.
  body: z.string().min(1),
  // Which nearby widgets the observation is about (widget IDs in the
  // same canvas). Empty array means "the canvas as a whole".
  about_widget_ids: z.array(z.string()).default([]),
  generation: GenerationMetaSchema,
});
export type AIObservationWidget = z.infer<typeof AIObservationWidgetSchema>;

// ── union ──

export const WidgetSchema = z.discriminatedUnion("type", [
  TextWidgetSchema,
  QuoteWidgetSchema,
  SourceRefWidgetSchema,
  DividerWidgetSchema,
  AIObservationWidgetSchema,
]);
export type Widget = z.infer<typeof WidgetSchema>;

export type WidgetType = Widget["type"];

// ── canvas ──

export const CanvasContentSchema = z.object({
  widgets: z.array(WidgetSchema),
});
export type CanvasContent = z.infer<typeof CanvasContentSchema>;

// Validate + narrow. Throws ZodError on shape mismatch — loud at the
// FFI between probability space and deterministic space.
export function parseCanvas(input: unknown): CanvasContent {
  return CanvasContentSchema.parse(input);
}

// Defensive: parse, but on failure return an empty canvas instead of
// throwing. Use this on read paths where we'd rather render an empty
// surface than 500 the page.
export function parseCanvasLenient(input: unknown): CanvasContent {
  if (!input) return { widgets: [] };
  try {
    return CanvasContentSchema.parse(input);
  } catch (err) {
    console.error("[widgets.parseCanvasLenient] dropped:", err);
    return { widgets: [] };
  }
}

// ── widget-type metadata ──
//
// Single source of truth for the picker labels and which widgets the
// student can add. AI-only widgets are filtered out of the picker.

export const STUDENT_ADDABLE_WIDGETS = [
  { type: "text" as const, label: "Text", glyph: "¶" },
  { type: "quote" as const, label: "Quote", glyph: "“ ”" },
  { type: "source_ref" as const, label: "Source", glyph: "↗" },
  { type: "divider" as const, label: "Divider", glyph: "—" },
];

export type AddableWidgetType = (typeof STUDENT_ADDABLE_WIDGETS)[number]["type"];
