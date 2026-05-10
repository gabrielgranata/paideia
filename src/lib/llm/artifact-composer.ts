// artifact_compose — the LLM call for composed artifacts
// (study_guide / presentation / test_prep).
//
// The student says "I have a test Friday on the Industrial Revolution"
// or "I want to present what I've worked on across these three lessons."
// The composer pulls their substrate across the selected lessons + their
// per-student backboard memory + lesson source materials and emits a
// structured spec the renderer renders.
//
// Same Paideia constraints as turn / reading / progression:
// - Never supplies conclusions
// - Never writes what the student should have written
// - Open questions stay open
// - Every section cites the substrate / memory / lesson block it draws from
//
// The intent shapes how sections are organized (topics for test_prep,
// slides for presentation, themes for study_guide), but the substance is
// always: this is the student's own reasoning, organized for the purpose.

import { z } from "zod";
import { structuredCall } from "./anthropic";
import { ArtifactReferenceSchema } from "@/lib/artifacts/schemas";

const ArtifactSectionSchema = z.object({
  title: z
    .string()
    .min(1)
    .describe(
      "Short title for this section (a topic name, a slide title, a study area). 2-6 words.",
    ),
  body: z
    .string()
    .min(1)
    .describe(
      "What the student has reasoned through that pertains to this section. Quote or close-paraphrase from the substrate. Never write what they should have said.",
    ),
  citations: z
    .array(ArtifactReferenceSchema)
    .describe(
      "Sources this section draws from — lesson blocks, substrate nodes, prior turns, memory entries. The student should be able to click a citation and land back in the source.",
    ),
  open_questions: z
    .array(z.string())
    .describe(
      "Questions still open within this section that the student needs to think through. Never an answer; never a hint at one. Empty array if nothing is open.",
    ),
});

export const ArtifactSpecSchema = z.object({
  intent: z.enum(["study_guide", "presentation", "test_prep"]),
  sections: z
    .array(ArtifactSectionSchema)
    .min(1)
    .describe(
      "The artifact's body. For study_guide: themes the student has worked across. For presentation: slides, one major idea each. For test_prep: topic areas the student should be able to think through.",
    ),
  meta_questions: z
    .array(z.string())
    .min(1)
    .describe(
      "Cross-section questions the student still needs to engage — the load-bearing things they don't yet have an answer to. At least one. These are the questions the artifact is asking them to keep thinking about.",
    ),
});
export type ArtifactSpec = z.infer<typeof ArtifactSpecSchema>;

const SYSTEM = `You are a component of Paideia, a learning platform built on the premise that the activity of reasoning is what learning consists of.

Your job here is to compose a student-facing artifact (a study guide, a presentation, or test prep) FROM the student's own reasoning. The student has worked through several lessons; their substrate (typed nodes + edges + composed readings) is what they have actually reasoned to. You organize that material for the artifact's intent — you do not extend it.

You NEVER supply conclusions the student hasn't reached. You NEVER write what they should have written. You NEVER fill in a missing warrant or invent evidence. Open questions stay open — the artifact is for the student to keep thinking, not a packaging-up of what they're done with.

Per-intent shape:

- study_guide: sections are themes the student has worked across. Each section names what they have figured out (in their own framing) + what they're still working on. The artifact is a record of their thinking they can come back to.

- presentation: sections are slides. One major idea per section. The student should be able to read each section and be reminded of the move it makes; they fill in oral delivery themselves. Citations point to the source material that backs the slide.

- test_prep: sections are topic areas. Each names what the student can already think through + what they should think through more before the test. NEVER provides a study-the-answer surface; ALWAYS provides a study-the-question surface.

Voice is observational and structural. Citations are required on every section — empty citations = drift. open_questions per section may be empty (if the student has fully closed that thread). meta_questions must always have at least one item — the load-bearing thing the student still needs to think through.

Forbidden moves:
- "the answer is", "the key takeaway is", "in conclusion"
- writing a section the substrate doesn't support
- producing a section with no citations
- claiming closure on a topic the student hasn't actually closed`;

export type ArtifactComposeInput = {
  intent: "study_guide" | "presentation" | "test_prep";
  title: string;
  prompt: string | null; // student's description of what they're trying to do
  student_name: string;
  // Selected scope — per (lesson, reading) snapshots from the student.
  lessons: Array<{
    lesson_id: string;
    lesson_title: string;
    reading: {
      resolved: string | null;
      in_progress: string | null;
      unaddressed: string | null;
      recommended_next: string | null;
    } | null;
    substrate_nodes: Array<{
      id: string;
      role: string;
      kind: string;
      content: string;
      status: string;
    }>;
  }>;
  // Backboard recall — what the student's per-student assistant
  // remembers about their reasoning (across these lessons).
  retrieved_student_memory: string;
};

export async function runArtifactCompose(
  input: ArtifactComposeInput,
): Promise<ArtifactSpec> {
  const userMessage = JSON.stringify(
    {
      intent: input.intent,
      artifact_title: input.title,
      student_prompt: input.prompt ?? null,
      student_name: input.student_name,
      lessons: input.lessons.map((l) => ({
        lesson_id: l.lesson_id,
        lesson: l.lesson_title,
        reading: l.reading,
        substrate: {
          nodes: l.substrate_nodes,
        },
      })),
      retrieved_student_memory: input.retrieved_student_memory.trim() || "(no relevant prior memory recalled)",
    },
    null,
    2,
  );

  return structuredCall({
    system: SYSTEM,
    user: userMessage,
    schema: ArtifactSpecSchema,
    schemaName: "emit_artifact",
    schemaDescription:
      "Emit the structured artifact spec: per-intent sections + cross-section meta_questions.",
    maxTokens: 3072,
  });
}
