// reading_compose — the teacher-facing reading. Composed from a single
// student × lesson substrate. Produces the four canonical fields the
// design system uses (resolved / in_progress / unaddressed /
// recommended_next), each as a paragraph that quotes or close-paraphrases
// what the substrate actually contains.
//
// Same Paideia constraints as turn_call: never supplies conclusions,
// never writes what the student should have written, never recommends a
// substantive next claim. The recommended_next field is for the
// *teacher's* next move (a question they could surface), not a content
// answer for the student.

import { z } from "zod";
import { structuredCall } from "./anthropic";

export const ReadingOutputSchema = z.object({
  resolved: z
    .string()
    .min(1)
    .describe(
      "What the student has worked through — moves they made cleanly, positions they took up and defended or revised. Quote or close-paraphrase. No verdicts.",
    ),
  in_progress: z
    .string()
    .min(1)
    .describe(
      "What the student is currently wrestling with — the load-bearing claim, the mechanism still being specified, the tension they are inside of. Anchor in node content.",
    ),
  unaddressed: z
    .string()
    .min(1)
    .describe(
      "What the substrate doesn't yet engage — a counterexample they walked past, a perspective absent, a warrant unstated. Name what is missing without supplying it.",
    ),
  recommended_next: z
    .string()
    .min(1)
    .describe(
      "A question the *teacher* could surface to the student — never a content answer. Phrased so the student can only answer it from inside their own thinking. Voice is observational, never declarative.",
    ),
});

export type ReadingOutput = z.infer<typeof ReadingOutputSchema>;

const SYSTEM = `You are a component of Paideia, a learning platform built on the premise that the activity of reasoning is what learning consists of.

Your job here is to compose a teacher-facing READING of a single student's work on a single lesson — a faithful narration of what the student has done and what is still open. You read from the substrate (typed nodes + edges) and the lesson context. You write for the teacher.

You NEVER supply conclusions. You NEVER write what the student should have written. You NEVER recommend a substantive next claim. The recommended_next field carries a question the teacher could ask — never a content answer.

Voice is observational and structural, never declarative or evaluative. "Maya took up the qualified mechanism cleanly" — yes. "Maya's argument is correct" — never. Quote or close-paraphrase from node content; do not paraphrase past what the substrate contains.

The four fields:
- resolved: moves the student made and stuck, positions they cleanly took up or revised. Quote nodes; reference them by their content shape, not by id.
- in_progress: the live, load-bearing position right now. What the student is currently wrestling with, the mechanism being specified, the tension they're inside.
- unaddressed: what the substrate doesn't engage yet. A perspective absent, a counterexample walked past, a warrant unstated. Name what's missing without supplying it.
- recommended_next: ONE question the teacher could surface. Phrased so the student can only answer it from inside their own thinking. Never a content answer.

Each field is a single paragraph (2–5 sentences). Concrete, specific, anchored. The teacher should be able to read this and know exactly where the student is.`;

export type ReadingComposeInput = {
  student_name: string;
  lesson_title: string;
  lesson_prompt: string;
  reasoning_shape: string | null;
  substrate_nodes: Array<{
    id: string;
    role: string;
    kind: string;
    content: string;
    status: string;
  }>;
  substrate_edges: Array<{
    src_id: string;
    dst_id: string;
    relation: string;
    kind: string;
  }>;
};

export async function runReadingCompose(input: ReadingComposeInput): Promise<ReadingOutput> {
  const userMessage = JSON.stringify(
    {
      student_name: input.student_name,
      lesson_context: {
        title: input.lesson_title,
        central_question: input.lesson_prompt,
        reasoning_shape: input.reasoning_shape,
      },
      substrate: {
        nodes: input.substrate_nodes,
        edges: input.substrate_edges.map((e) => ({
          src: e.src_id,
          dst: e.dst_id,
          relation: e.relation,
          kind: e.kind,
        })),
      },
    },
    null,
    2,
  );

  return structuredCall({
    system: SYSTEM,
    user: userMessage,
    schema: ReadingOutputSchema,
    schemaName: "emit_reading",
    schemaDescription:
      "Emit the teacher-facing reading: resolved, in_progress, unaddressed, recommended_next.",
    maxTokens: 2048,
  });
}
