// turn_call — the combined ingest + gap-surface + compose call.
//
// One bounded LLM step per student turn. Forbidden output fields per the
// paideia-prompt skill: no `summary`, no `answer`, no `recommendation`,
// no `notes`. The schema is structured so the model literally cannot emit
// a conclusion-shaped value.
//
// Inputs: lesson context + current substrate slice + the student's new
// prose. Outputs: substrate delta (typed nodes + edges), an optional
// next-gap question (closed move_type vocabulary), and an optional
// composed read-back where every sentence must cite node ids.
//
// The applier (`@/lib/substrate/applier`) takes this output, generates
// real node ids, resolves tmp_id refs in edges and citations, and writes
// to Postgres. Backboard memory writes (per-student / per-lesson) are
// fire-and-forget separately, not part of this call.

import { z } from "zod";
import { structuredCall } from "./anthropic";

// ── output schema ────────────────────────────────────────────────────────

const NewNodeSchema = z.object({
  tmp_id: z
    .string()
    .min(1)
    .describe(
      "Stable identifier for this new node within this call. Used by edges and the composed_view to refer to the node before its real id is assigned.",
    ),
  role: z
    .enum(["assertion", "support", "challenge", "inquiry"])
    .describe(
      "Closed structural axis. assertion=a position the student is taking; support=evidence/mechanism/warrant backing an assertion; challenge=counterexample/objection/complication; inquiry=an open question.",
    ),
  kind: z
    .string()
    .min(1)
    .describe(
      "Open human-readable descriptor (e.g. 'causal claim', 'mechanistic support', 'vulnerability mechanism', 'counterexample', 'qualifier', 'open question').",
    ),
  content: z
    .string()
    .min(1)
    .describe(
      "The node's content in the student's framing — quote or close-paraphrase from their prose. Do not write what they should have said.",
    ),
});

const NewEdgeSchema = z.object({
  src_ref: z
    .string()
    .min(1)
    .describe(
      "Source node — either a tmp_id from new_nodes or an existing node id from the substrate.",
    ),
  dst_ref: z
    .string()
    .min(1)
    .describe(
      "Destination node — either a tmp_id from new_nodes or an existing node id.",
    ),
  relation: z
    .enum(["positive", "negative", "depends"])
    .describe(
      "Closed enum. positive=supports/refines. negative=challenges/contradicts. depends=addresses/depends-on.",
    ),
  kind: z
    .string()
    .min(1)
    .describe(
      "Human-readable edge label (e.g. 'supports', 'refines', 'challenges', 'addresses by', 'presupposes').",
    ),
});

const NextGapSchema = z.object({
  move_type: z
    .enum([
      "observation",
      "question",
      "structural-prompt",
      "named-tension",
      "missing-perspective",
      "candidate-counterexample",
    ])
    .describe(
      "The kind of move you are surfacing. Closed enum — there is no 'answer' or 'conclusion' option.",
    ),
  target_node_ids: z
    .array(z.string())
    .describe(
      "Which nodes (existing ids or tmp_ids from new_nodes) the gap touches.",
    ),
  prompt_to_student: z
    .string()
    .min(1)
    .describe(
      "The question, in second person, observational and structural. Never declarative or evaluative. The student must be able to answer this only from inside their own thinking.",
    ),
});

const ComposedSentenceSchema = z.object({
  text: z.string().min(1),
  cites: z
    .array(z.string())
    .describe(
      "Node ids (existing or tmp_id) the sentence derives from. Empty cites are allowed only for explicit meta-prose like 'Your argument so far:'.",
    ),
});

const ComposedViewSchema = z.object({
  sentences: z.array(ComposedSentenceSchema).min(1),
});

export const TurnOutputSchema = z.object({
  new_nodes: z
    .array(NewNodeSchema)
    .describe(
      "New nodes extracted from the student's prose. Empty array if the prose adds nothing structurally new.",
    ),
  new_edges: z
    .array(NewEdgeSchema)
    .describe(
      "New edges connecting new nodes to each other or to existing nodes. Empty array if no new connections.",
    ),
  next_gap: NextGapSchema.nullable().describe(
    "The most pressing structural defect surfaced as a question. Null only if there is genuinely nothing to ask. When uncertain, surface uncertainty as a question — never default to a confident completion.",
  ),
  composed_view: ComposedViewSchema.nullable().describe(
    "A brief read-back of the argument so far in the student's framing. Every sentence must cite node ids. Return null if the substrate is too thin to compose meaningfully.",
  ),
});

export type TurnOutput = z.infer<typeof TurnOutputSchema>;

// ── system prompt ────────────────────────────────────────────────────────
//
// Opens with the verbatim Paideia constraint paragraph from the
// paideia-prompt skill. The schema makes the constraint enforceable; the
// prompt just states it explicitly so the model orients correctly.

const SYSTEM = `You are a component of Paideia, a learning platform built on the premise that the activity of reasoning is what learning consists of.

Your job is to make the student's reasoning legible — to read it back, to surface structural defects, to ask questions that force the student to make the next inferential move themselves. You NEVER supply conclusions. You NEVER complete the student's thought. You NEVER write what the student should have written. If you are tempted to do any of those things, your output is wrong by construction, and the schema you must produce does not have a field for it.

Your output has three parts:

1. SUBSTRATE DELTA. Extract from the student's new prose any new claims, supports, challenges, or inquiries. Emit them as new_nodes with role (closed enum) + kind (open descriptor) + content (in the student's framing — quote or close-paraphrase). Connect them with new_edges (positive / negative / depends).

   When the student revises an earlier position, emit a NEW node with the refined content rather than rewriting the old node. The applier marks the old node as superseded. Use a "refines" or "qualifies" edge from the new assertion to the old one with relation=positive.

   When the student backs an existing claim with new evidence, add a support node and a positive edge from support → assertion. Existing nodes are referenced by their id; new nodes by their tmp_id.

2. NEXT GAP. The most pressing structural defect to surface as a question. Phrase as a question to the student. Voice is observational and structural — never declarative, never evaluative.

   Move types: observation (name a structural feature), question (interrogate a gap), structural-prompt (surface a schema-level move), named-tension (point at two substrate elements in conflict), missing-perspective (flag a viewpoint the substrate does not engage), candidate-counterexample (surface a case the student should consider).

   When uncertain about which gap to surface, surface the uncertainty as a question to the student. Never default to a confident completion. The schema has no field for an answer.

3. COMPOSED VIEW (optional). A brief read-back of the argument so far, organized by what is present and what is unfinished. Every sentence must cite the node ids it derives from. Empty cites are only for explicit meta-prose. Never write anything the substrate does not support. Return null if the substrate is too thin to compose meaningfully.

Forbidden moves: writing the student's reasoning for them; supplying a conclusion; summarizing past the substrate; saying "the answer is" or "you should conclude"; producing a recommendation that contains a substantive next claim.

Two additional inputs may be present:

- retrieved_student_memory: a short recall of what this student has worked through in prior sessions. Use it to deepen the next question ("you wrestled with a similar mechanism in lesson 4 — does this case bear on that?"). Never use it to supply substantive content the student hasn't reasoned to here.

- retrieved_lesson_context: a RAG hit from the lesson's source materials. Use it to anchor questions in specific passages the student should engage. Never paraphrase a source as if you were arguing for it; quote or point.

If either is "(no relevant prior memory recalled)" / "(no relevant lesson source material recalled)" or empty, proceed without it.`;

// ── caller ───────────────────────────────────────────────────────────────

export type TurnCallInput = {
  lesson_prompt: string;
  reasoning_shape: string | null;
  expected_kinds: string[] | null;
  anticipated_gaps: string[] | null;
  substrate_nodes: Array<{
    id: string;
    role: string;
    kind: string;
    content: string;
    status: string;
  }>;
  substrate_edges: Array<{
    id: string;
    src_id: string;
    dst_id: string;
    relation: string;
    kind: string;
  }>;
  prior_turns: Array<{ raw_prose: string }>;
  raw_prose: string;
  // Backboard retrieval — optional. Empty string = nothing recalled OR
  // backboard unavailable; the call degrades gracefully either way.
  retrieved_student_memory?: string;
  retrieved_lesson_context?: string;
};

export async function runTurnCall(input: TurnCallInput): Promise<TurnOutput> {
  // Typed slice as input — not raw chat history. The substrate is the
  // system of record between turns. Retrieved memory + lesson context come
  // from backboard and are advisory: they shape *which question to ask
  // next*; they never become content the system asserts on the student's
  // behalf.
  const userMessage = JSON.stringify(
    {
      lesson_context: {
        central_question: input.lesson_prompt,
        reasoning_shape: input.reasoning_shape,
        expected_kinds: input.expected_kinds,
        anticipated_gaps: input.anticipated_gaps,
      },
      current_substrate: {
        nodes: input.substrate_nodes.map((n) => ({
          id: n.id,
          role: n.role,
          kind: n.kind,
          content: n.content,
          status: n.status,
        })),
        edges: input.substrate_edges.map((e) => ({
          src: e.src_id,
          dst: e.dst_id,
          relation: e.relation,
          kind: e.kind,
        })),
      },
      prior_turn_summary:
        input.prior_turns.length === 0
          ? "no prior turns"
          : `${input.prior_turns.length} prior turn(s); the last was: ${truncate(input.prior_turns[input.prior_turns.length - 1].raw_prose, 600)}`,
      student_new_prose: input.raw_prose,
      retrieved_student_memory: input.retrieved_student_memory?.trim()
        ? truncate(input.retrieved_student_memory, 1500)
        : "(no relevant prior memory recalled)",
      retrieved_lesson_context: input.retrieved_lesson_context?.trim()
        ? truncate(input.retrieved_lesson_context, 1500)
        : "(no relevant lesson source material recalled)",
    },
    null,
    2,
  );

  return structuredCall({
    system: SYSTEM,
    user: userMessage,
    schema: TurnOutputSchema,
    schemaName: "emit_turn",
    schemaDescription:
      "Emit the substrate delta, next gap question, and composed read-back for this student turn.",
    maxTokens: 3072,
  });
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}
