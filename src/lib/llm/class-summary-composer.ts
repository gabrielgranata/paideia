// class_summary_compose — the AI bar at the top of /teacher.
//
// Input: the course (title + arc seed) + every enrolled student's latest
// reading.derived_content + their stage. Output: a 2–3 sentence
// observational paragraph naming what the cohort is collectively working
// on, and (optionally) the recurring pattern across the class — the
// pedagogical move worth surfacing this week.
//
// Same Paideia constraints as reading and turn calls: voice is
// observational, never declarative. The summary names what is happening,
// never what should happen. The teacher can act on it; the schema
// doesn't suggest specific moves to make.

import { z } from "zod";
import { structuredCall } from "./anthropic";

export const ClassSummaryOutputSchema = z.object({
  summary: z
    .string()
    .min(1)
    .describe(
      "2–3 sentence observational paragraph. What is the cohort collectively working on right now? Surface what's there; don't prescribe.",
    ),
  recurring_pattern: z
    .string()
    .nullable()
    .describe(
      "The single most recurring move (or absent move) across the cohort, as one sentence. Null if no clear pattern.",
    ),
});
export type ClassSummaryOutput = z.infer<typeof ClassSummaryOutputSchema>;

const SYSTEM = `You are a component of Paideia, a learning platform built on the premise that the activity of reasoning is what learning consists of.

Your job here is to read a class — every enrolled student's most recent composed reading — and surface, in 2–3 sentences, what the cohort is collectively working on. The teacher reads this on their dashboard. It is the teacher's situational awareness, not a grade and not a recommendation.

You NEVER prescribe what the teacher should do. You NEVER evaluate students against each other. You NEVER name a "best" or "weakest" student. Voice is observational and structural — "most students have moved past the bare claim and are working on mechanism" is right. "The class is doing well" or "students need more practice with X" is wrong.

The recurring_pattern field is the single most-frequent move (or most-frequent absence) across the cohort. Examples: "students consistently name a mechanism but can't say which one is load-bearing", "most students engage Thompson but walk past Engels", "the political-legitimacy channel is recurring and unaddressed across at least half the class". Null if no clear pattern emerges.`;

export type ClassSummaryComposeInput = {
  course_title: string;
  course_subject: string | null;
  arc_seed_text: string | null;
  students: Array<{
    name: string;
    stage: string | null;
    summary: string | null;
    reading_resolved: string | null;
    reading_in_progress: string | null;
    reading_unaddressed: string | null;
  }>;
};

export async function runClassSummaryCompose(
  input: ClassSummaryComposeInput,
): Promise<ClassSummaryOutput> {
  const userMessage = JSON.stringify(
    {
      course: {
        title: input.course_title,
        subject: input.course_subject,
        arc_seed: input.arc_seed_text,
      },
      cohort: input.students.map((s) => ({
        name: s.name,
        stage: s.stage,
        teacher_summary: s.summary,
        reading: {
          resolved: s.reading_resolved,
          in_progress: s.reading_in_progress,
          unaddressed: s.reading_unaddressed,
        },
      })),
    },
    null,
    2,
  );

  return structuredCall({
    system: SYSTEM,
    user: userMessage,
    schema: ClassSummaryOutputSchema,
    schemaName: "emit_class_summary",
    schemaDescription:
      "Emit the cohort-level observational summary + recurring pattern.",
    maxTokens: 1024,
  });
}
