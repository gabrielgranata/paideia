// lesson-content-composer — the 6th bounded LLM call in the system.
//
// Scope, named explicitly to prevent drift:
//
//   This composer authors TEACHER SOURCE MATERIAL — content the teacher
//   curates into a lesson for students to reason against. It NEVER reads
//   from substrate, NEVER writes to substrate, NEVER touches sessions /
//   turns / nodes / edges. The structural boundary is enforced at the
//   import level: this file imports nothing from @/lib/substrate or any
//   session/turn-shaped code path.
//
// This call is non-substrate-bounded, which is the meaningful structural
// distinction from the other 5 calls in the pipeline (ingest, gap-surface,
// reading composer, progression composer, artifact composer — all of which
// operate on student reasoning traces). Future LLM calls in the system
// should be classified by this same axis and audited per /paideia-fidelity-check.
//
// Output discipline:
//
//   - The LLM emits a segment WITHOUT id or generation metadata (those are
//     server-set after a successful call). Splitting the type this way
//     makes "the LLM forges its own audit trail" structurally impossible.
//   - No free-form completion fields. The schema accepts only typed
//     content per sub_kind (paragraph, chart, diagram). The LLM cannot
//     return summary, reasoning, alternatives_considered, or recommendation.
//   - For charts: data_source.kind is closed. ai_proposed_from_topic
//     REQUIRES a caveat string. The LLM cannot dress invented data as
//     teacher-supplied.
//
// Voice constraints (in SYSTEM):
//
//   - Source material is allowed to be declarative — that's its job. But
//     the composer preserves the *messy* shape of real source material:
//     hedges, conflicts, gaps. Smoothed-out source material habituates
//     students to expect cogency from the world and makes off-platform
//     reasoning harder.
//   - Captions on charts and diagrams describe WHAT THE FIGURE SHOWS,
//     never WHAT THE STUDENT SHOULD CONCLUDE.
//   - Conclusions about the lesson's central question are NEVER supplied.
//     The student does that reasoning.

import { z } from "zod";
import { structuredCall } from "./anthropic";
import {
  LLMEmittedAISegmentSchema,
  type LLMEmittedAISegment,
} from "@/lib/lesson-blocks";

// ── Input schema ─────────────────────────────────────────────────────

const ParagraphRequestSchema = z.object({
  sub_kind: z.literal("paragraph"),
  brief: z.string().min(1),
  surrounding_text: z.string(), // context around the cursor; may be empty
});

const ChartRequestSchema = z.object({
  sub_kind: z.literal("chart"),
  brief: z.string().min(1),
  // If the teacher supplied their own data, it lands here as a raw string
  // (CSV / JSON / prose). The composer interprets this as authoritative —
  // it should NOT propose its own data when teacher_data is non-empty;
  // it should parse and visualize the supplied data.
  teacher_data: z.string().optional(),
  surrounding_text: z.string(),
});

const DiagramRequestSchema = z.object({
  sub_kind: z.literal("diagram"),
  brief: z.string().min(1),
  surrounding_text: z.string(),
});

export const ComposerInputSchema = z.object({
  lesson_id: z.string().min(1),
  block_id: z.string().min(1),
  request: z.discriminatedUnion("sub_kind", [
    ParagraphRequestSchema,
    ChartRequestSchema,
    DiagramRequestSchema,
  ]),
  lesson_title: z.string(),
  lesson_prompt: z.string(),
});
export type ComposerInput = z.infer<typeof ComposerInputSchema>;

// ── System prompt ────────────────────────────────────────────────────

const SYSTEM = `You are a component of Paideia, a learning platform built on the premise that the activity of reasoning is what learning consists of.

Your specific role here is narrower than the rest of the pipeline. You author TEACHER SOURCE MATERIAL — content the teacher curates into a lesson for students to read and reason against. You are NOT composing on a student's behalf. You are NOT writing claims for a student. You are not in the student loop at all.

What you may do
- Write paragraphs of source material: background, definitions, perspectives, counter-positions, primary-source excerpts cast in the teacher's framing.
- Propose chart visualizations of data (the teacher's data when supplied; otherwise illustrative data with explicit provenance).
- Propose concept diagrams (typed nodes + edges) of structural relationships in source material.

What you NEVER do
- You NEVER state or imply a conclusion to the lesson's central question. The student does that reasoning.
- You NEVER smooth out conflicts, hedge inconvenient evidence, or pre-resolve tensions in the source material. Real source material is messy; learners need to encounter that messiness. If a topic has live disagreements, surface them as such — name the positions, do not adjudicate.
- You NEVER produce a "balanced summary" or "key takeaway." Captions and prose describe; they do not adjudicate.
- You NEVER fabricate quotes from named sources. If you need a primary-source quote, the teacher will paste one in; you may paraphrase from general knowledge but must mark it as paraphrase.

Voice
- Declarative is permitted (source material asserts things — that IS its job). But voice should sound like good textbook prose or primary-source paraphrase, not like an AI assistant. No "let's explore," no "we can see that," no "in conclusion."
- Captions on charts and diagrams describe what the figure shows, never what the student should conclude from it. "Wheat prices, 1780–1789" — yes. "Wheat prices, which caused the Revolution" — never.
- Avoid hedging tics ("it's complex," "many factors contribute"). Either name the specific complications or don't gesture at complexity.

Chart data provenance — this is structurally enforced and you must honor it
- If teacher_data is non-empty: parse it as authoritative. Set data_source.kind to "teacher_supplied" and raw_input to the teacher's original string. Do not modify the values.
- If teacher_data is empty AND the brief references a specific document or text the teacher provided in surrounding_text: extract data from that text. Set data_source.kind to "ai_extracted_from_text" and source_text to the relevant excerpt.
- Otherwise: you are proposing data from your training knowledge. Set data_source.kind to "ai_proposed_from_topic" and write a caveat string that names this honestly ("Illustrative figures based on standard secondary-source ranges; verify before publishing"). Do not pretend the data is authoritative — the schema makes this impossible to hide and the teacher will see your caveat.

Diagrams
- Nodes carry an open kind descriptor (e.g. "actor", "mechanism", "outcome", "constraint"). Pick descriptors that map onto how scholars discuss the topic, not generic ones.
- Edges have a closed relation enum: positive, negative, depends. Pick the relation that matches what the structure asserts. "positive" = supports / amplifies / causes-positively; "negative" = opposes / undermines / causes-negatively; "depends" = presupposes / requires.
- Edges also carry an open kind descriptor that names the specific relation ("amplifies", "qualifies", "presupposes", "blocks").

Output
- One segment, returned via the emit_segment tool. The shape is constrained by the tool's input_schema; you must emit valid JSON matching it exactly.
- Do not include id or generation fields — the server attaches those.`;

// ── The call ─────────────────────────────────────────────────────────

export type LessonContentComposerResult = LLMEmittedAISegment;

/**
 * Run the lesson-content composer. Returns the LLM-emitted segment shape;
 * the caller (route handler) attaches id + generation metadata and persists
 * to lessons.blocks via the appropriate server action.
 */
export async function runLessonContentCompose(
  input: ComposerInput,
): Promise<LessonContentComposerResult> {
  const validated = ComposerInputSchema.parse(input);

  // Compose the user message as a JSON brief. We make every field
  // explicit; the model should not need to infer what it's doing.
  const userMessage = JSON.stringify(
    {
      lesson: {
        title: validated.lesson_title,
        central_question: validated.lesson_prompt,
      },
      request: validated.request,
    },
    null,
    2,
  );

  return structuredCall({
    system: SYSTEM,
    user: userMessage,
    schema: LLMEmittedAISegmentSchema,
    schemaName: "emit_segment",
    schemaDescription:
      "Emit ONE segment of teacher source material: an AI paragraph, an AI chart proposal, or an AI concept diagram. Honor the data-provenance discipline for charts.",
    maxTokens: 3072,
  });
}
