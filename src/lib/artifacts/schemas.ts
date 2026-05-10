// Artifact content schemas.
//
// The artifacts table envelope { id, owner_type, owner_id, type, title,
// prompt, source_scope, audience, spec_json, status } stays untouched.
// What we add here: a locked enum for `type` and per-type Zod schemas
// for `spec_json` content.
//
// Two families, by who authors:
//
//   Student-authored writing:
//     essay, source_analysis, reflection, argument
//
//   Student-built structured artifacts:
//     chart, data_exploration, quiz_response
//
//   Lightweight personal:
//     note
//
//   LLM-composed cross-cutting reads (student-initiated):
//     study_guide, presentation, test_prep
//
// The discriminator is the artifact's `type` column (locked enum). The
// per-type content schema constrains `spec_json` so the renderer can be
// exhaustive over content shape and the composer LLM can't smuggle
// fields the schema doesn't allow.
//
// Provenance discipline (mirrors lesson-blocks):
//   - student-authored content carries no AI marker
//   - LLM-composed content carries the `composed_by_llm: true` flag and a
//     generation metadata object (model, prompt, timestamp)
//   - chart / data artifacts carry an explicit DataSource per the same
//     three-kind enum used in lesson-blocks (teacher_supplied /
//     ai_extracted_from_text / ai_proposed_from_topic)
//
// The schema makes "AI silently asserts data" structurally impossible.

import { z } from "zod";
import {
  DataSourceSchema,
  GenerationMetaSchema,
  VegaLiteSpecSchema,
} from "@/lib/lesson-blocks";

// ── Type enum ─────────────────────────────────────────────────────────
//
// Closed. Each value has a content schema below; the renderer is
// exhaustive over them. Adding a new artifact type means adding it here
// AND adding a content schema AND updating any consumer that switches
// over types — TS exhaustiveness will catch every site.

export const ArtifactTypeSchema = z.enum([
  // Student-authored writing
  "essay",
  "source_analysis",
  "reflection",
  "argument",

  // Student-built structured
  "chart",
  "data_exploration",
  "quiz_response",

  // Personal
  "note",

  // LLM-composed (student-initiated)
  "study_guide",
  "presentation",
  "test_prep",
]);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

// ── Reference — pointer back to the substrate ─────────────────────────
//
// Most artifact contents reference upstream material: a lesson block, a
// substrate node, a prior turn, or another artifact. The reference is
// structured so the renderer can resolve to a real navigation target
// (the design system's `↗` and `◇` link chips).

export const ArtifactReferenceSchema = z.object({
  // What the link points at. Closed enum so the renderer can route
  // each kind to the right surface.
  ref_type: z.enum([
    "lesson_block", // a block within a lesson
    "node",          // a substrate node
    "turn",          // a turn in a session
    "artifact",      // another artifact
    "memory",        // a backboard memory id
    "external_url",  // out-of-platform link (rare; flag for review)
  ]),
  ref_id: z.string().min(1),
  // Origin: did the student cite this themselves, or did the LLM
  // surface it via retrieval? The chip color in the design distinguishes
  // ↗ (teacher material) from ◇ (prior student work) — we record both.
  origin: z.enum(["student_cited", "ai_surfaced", "teacher_attached"]),
  // Optional human-readable label for the chip. If omitted, the renderer
  // resolves the label from the ref_id at render time.
  label: z.string().optional(),
});
export type ArtifactReference = z.infer<typeof ArtifactReferenceSchema>;

// ── Writing artifacts (essay / source_analysis / reflection / argument)

// All four share the same content shape: a body of student prose with
// optional references and word count. The artifact's TYPE distinguishes
// what kind of writing the assignment was, not the content shape.
export const WritingContentSchema = z.object({
  body: z.string(),
  word_count: z.number().int().nonnegative().optional(),
  // Sources/quotes the student is responding to. Renderer shows them as
  // the design's `↗` chips.
  references: z.array(ArtifactReferenceSchema).optional(),
  // Optional draft history snapshots. v0 stores the latest body only;
  // history can be appended later without a schema migration.
  history: z
    .array(
      z.object({
        snapshot_at: z.string(),
        body: z.string(),
      }),
    )
    .optional(),
});
export type WritingContent = z.infer<typeof WritingContentSchema>;

// ── Chart artifact ────────────────────────────────────────────────────
//
// The student picks a metric / series from a teacher-supplied dataset and
// builds a visualization. The content carries the spec, the data, and the
// explicit data source so the renderer can show provenance.

export const ChartContentSchema = z.object({
  metric: z.string().min(1),       // e.g. "factory_workers"
  caption: z.string().optional(),
  spec: VegaLiteSpecSchema,        // narrow allow-list spec
  data: z.array(z.record(z.string(), z.unknown())).min(1),
  data_source: DataSourceSchema,   // closed three-kind enum
  // What the student's chart is anchored to (a data block, an assignment).
  references: z.array(ArtifactReferenceSchema).optional(),
});
export type ChartContent = z.infer<typeof ChartContentSchema>;

// ── Data exploration ──────────────────────────────────────────────────
//
// The student is exploring a dataset before they commit to a chart. The
// content captures filter state, queries run, and prose notes. Like an
// honest record of how they came to their visualization.

export const DataExplorationContentSchema = z.object({
  dataset_block_id: z.string().min(1), // points at a lesson `data` block
  filters: z
    .array(
      z.object({
        column: z.string(),
        op: z.enum(["eq", "neq", "gt", "lt", "gte", "lte", "in", "between"]),
        value: z.unknown(),
      }),
    )
    .optional(),
  // Free-form prose: what the student noticed. AI does NOT write here.
  notes: z.string().optional(),
});
export type DataExplorationContent = z.infer<typeof DataExplorationContentSchema>;

// ── Quiz response ────────────────────────────────────────────────────

export const QuizResponseContentSchema = z.object({
  // Quiz block this response is for (lesson_blocks.id of the quiz block).
  quiz_block_id: z.string().min(1),
  responses: z
    .array(
      z.object({
        question_id: z.string().min(1),
        answer: z.string(),
        // The student may invoke Think-out-loud per question — we track
        // which session turn (if any) they wrote it in.
        think_out_loud_turn_id: z.string().optional(),
      }),
    )
    .min(1),
});
export type QuizResponseContent = z.infer<typeof QuizResponseContentSchema>;

// ── Note ──────────────────────────────────────────────────────────────
//
// Notion-style canvas: a stacked list of widgets the student composes
// (with optional AI ◆ widgets the system can drop in as observations).
// The widget catalog lives in @/lib/widgets/schemas.

import { CanvasContentSchema as _CanvasContentSchema } from "@/lib/widgets/schemas";

export const NoteContentSchema = _CanvasContentSchema.extend({
  // Optional tags carried from the previous (single-body) shape — kept
  // because the schema is forward-compatible and tags are useful
  // independent of the canvas.
  tags: z.array(z.string()).optional(),
});
export type NoteContent = z.infer<typeof NoteContentSchema>;

// ── Composed (LLM-emitted) ────────────────────────────────────────────
//
// study_guide / presentation / test_prep. The student requests one with
// an intent + scope (which lessons/artifacts to draw from); the artifact
// composer LLM emits a structured spec the renderer interprets. The spec
// shape is intentionally loose at this layer (the per-intent renderers
// can validate further); we lock the wrapper.

export const ComposedScopeSchema = z.object({
  // Lesson(s) the artifact draws from.
  lesson_ids: z.array(z.string()),
  // Whether to include the student's per-student backboard memory.
  include_memory: z.boolean().default(true),
  // Whether to RAG over teacher-uploaded documents.
  include_documents: z.boolean().default(true),
  // Optional: limit to a subset of artifacts the student has produced.
  artifact_ids: z.array(z.string()).optional(),
});
export type ComposedScope = z.infer<typeof ComposedScopeSchema>;

export const ComposedContentSchema = z.object({
  scope: ComposedScopeSchema,
  // The composer's free-form structured spec. Per-intent renderers cast
  // and validate further. Kept loose here to allow each intent to evolve
  // its layout without churning the envelope.
  spec: z.unknown(),
  // Provenance is non-optional: every composed artifact carries who/what
  // generated it and when.
  generation: GenerationMetaSchema,
  // Citations the composer pulled from. Same Reference shape as writing
  // artifacts — the renderer turns these into `↗` chips.
  references: z.array(ArtifactReferenceSchema).optional(),
});
export type ComposedContent = z.infer<typeof ComposedContentSchema>;

// ── Top-level artifact envelope ───────────────────────────────────────
//
// Mirrors the `artifacts` table columns we already have, plus the typed
// content. Reading from DB: cast the row, then `parseArtifactContent` to
// narrow `spec_json` to the right per-type schema.

export const ArtifactStatusSchema = z.enum([
  "pending",
  "composing",
  "ready",
  "failed",
]);
export type ArtifactStatus = z.infer<typeof ArtifactStatusSchema>;

export const OwnerTypeSchema = z.enum(["student", "teacher"]);
export type OwnerType = z.infer<typeof OwnerTypeSchema>;

export const AudienceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("self") }),
  z.object({ type: z.literal("student"), ref_id: z.string().min(1) }),
  z.object({ type: z.literal("class"), ref_id: z.string().min(1) }),
]);
export type Audience = z.infer<typeof AudienceSchema>;

// Top-level envelope. `content` is unknown at the envelope level —
// per-type narrowing lives in `parseArtifactContent`.
export const ArtifactEnvelopeSchema = z.object({
  id: z.string().min(1),
  owner_type: OwnerTypeSchema,
  owner_id: z.string().min(1),
  type: ArtifactTypeSchema,
  title: z.string().min(1),
  prompt: z.string().nullable().optional(),
  source_scope: z.unknown(),
  audience: AudienceSchema.nullable().optional(),
  spec_json: z.unknown().optional(),
  status: ArtifactStatusSchema.default("pending"),
});
export type ArtifactEnvelope = z.infer<typeof ArtifactEnvelopeSchema>;

// ── Discriminated content union ───────────────────────────────────────
//
// The shape of `spec_json` per `type`. Use `parseArtifactContent` to
// validate and narrow.

export type ArtifactContentByType = {
  essay: WritingContent;
  source_analysis: WritingContent;
  reflection: WritingContent;
  argument: WritingContent;
  chart: ChartContent;
  data_exploration: DataExplorationContent;
  quiz_response: QuizResponseContent;
  note: NoteContent;
  study_guide: ComposedContent;
  presentation: ComposedContent;
  test_prep: ComposedContent;
};

export type TypedArtifact<T extends ArtifactType = ArtifactType> = {
  [K in ArtifactType]: Omit<ArtifactEnvelope, "spec_json" | "type"> & {
    type: K;
    content: ArtifactContentByType[K];
  };
}[T];

// Per-type schema map — used by `parseArtifactContent` to dispatch.
export const CONTENT_SCHEMA_BY_TYPE: {
  [K in ArtifactType]: z.ZodType<ArtifactContentByType[K]>;
} = {
  essay: WritingContentSchema,
  source_analysis: WritingContentSchema,
  reflection: WritingContentSchema,
  argument: WritingContentSchema,
  chart: ChartContentSchema,
  data_exploration: DataExplorationContentSchema,
  quiz_response: QuizResponseContentSchema,
  note: NoteContentSchema,
  study_guide: ComposedContentSchema,
  presentation: ComposedContentSchema,
  test_prep: ComposedContentSchema,
};

// Validate and narrow a single artifact. Throws ZodError on shape
// mismatch — the FFI must be loud, not silently broken.
export function parseArtifact(input: unknown): TypedArtifact {
  const env = ArtifactEnvelopeSchema.parse(input);
  const schema = CONTENT_SCHEMA_BY_TYPE[env.type];
  const content = schema.parse(env.spec_json) as ArtifactContentByType[typeof env.type];
  return {
    id: env.id,
    owner_type: env.owner_type,
    owner_id: env.owner_id,
    type: env.type,
    title: env.title,
    prompt: env.prompt ?? null,
    source_scope: env.source_scope,
    audience: env.audience ?? null,
    status: env.status,
    content,
  } as TypedArtifact;
}

// Defensive helper: parse an array of raw artifact rows. On per-row
// failure, log and skip — one bad artifact does not kill the page.
export function parseArtifactsLenient(input: unknown): TypedArtifact[] {
  if (!Array.isArray(input)) return [];
  const out: TypedArtifact[] = [];
  for (const raw of input) {
    try {
      out.push(parseArtifact(raw));
    } catch (err) {
      console.error("[artifacts.parseArtifactsLenient] dropped one:", err);
    }
  }
  return out;
}

// ── Categorization helpers ────────────────────────────────────────────
//
// The three families used throughout the UI: writing, structured,
// composed. Used to decide which renderer to dispatch + which group on
// the portfolio.

export const WRITING_TYPES = [
  "essay",
  "source_analysis",
  "reflection",
  "argument",
] as const satisfies ReadonlyArray<ArtifactType>;

export const STRUCTURED_TYPES = [
  "chart",
  "data_exploration",
  "quiz_response",
] as const satisfies ReadonlyArray<ArtifactType>;

export const COMPOSED_TYPES = [
  "study_guide",
  "presentation",
  "test_prep",
] as const satisfies ReadonlyArray<ArtifactType>;

export const PERSONAL_TYPES = ["note"] as const satisfies ReadonlyArray<ArtifactType>;

export type WritingType = (typeof WRITING_TYPES)[number];
export type StructuredType = (typeof STRUCTURED_TYPES)[number];
export type ComposedType = (typeof COMPOSED_TYPES)[number];
export type PersonalType = (typeof PERSONAL_TYPES)[number];

export function isWriting(t: ArtifactType): t is WritingType {
  return (WRITING_TYPES as ReadonlyArray<string>).includes(t);
}
export function isStructured(t: ArtifactType): t is StructuredType {
  return (STRUCTURED_TYPES as ReadonlyArray<string>).includes(t);
}
export function isComposed(t: ArtifactType): t is ComposedType {
  return (COMPOSED_TYPES as ReadonlyArray<string>).includes(t);
}
export function isPersonal(t: ArtifactType): t is PersonalType {
  return (PERSONAL_TYPES as ReadonlyArray<string>).includes(t);
}

// ── UI labels — single source of truth ────────────────────────────────
//
// The renderer turns these into the type chip on artifact cards. Title-
// case for badges; lowercase / kebab for `type` enum values.

export const ARTIFACT_LABEL: Record<ArtifactType, string> = {
  essay: "Essay",
  source_analysis: "Source analysis",
  reflection: "Reflection",
  argument: "Argument",
  chart: "Chart",
  data_exploration: "Data exploration",
  quiz_response: "Quiz response",
  note: "Note",
  study_guide: "Study guide",
  presentation: "Presentation",
  test_prep: "Test prep",
};
