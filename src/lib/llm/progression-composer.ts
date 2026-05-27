// progression_compose — the across-time narration of a student's
// reasoning maturation. Composed from the student's per-lesson readings
// (chronological), the course arc seed, and a backboard recall over the
// per-student profile. Produces the four canonical moves the
// progression view renders:
//
//   prior_state       — where the student was (was)
//   inflection_moment — what changed and when (shift)
//   current_state     — where the student is now (now)
//   recommended_next  — the question the system observes as the next
//                       move (never a directive, never a content answer)
//
// Anchors travel with each historical move so the renderer (and future
// drilldown) can resolve back to the lesson the move is grounded in.
// recommended_next does not carry anchors — it is forward-looking and
// observational, not a citation of past work.
//
// Voice discipline matches the reading composer: observational and
// structural. No verdicts. No score-shaped phrasing. No motivational
// language. The student or teacher who reads this should learn
// something about how the thinking moved, not be flattered or graded.

import { z } from "zod";
import { structuredCall } from "./anthropic";

export const ProgressionOutputSchema = z.object({
  prior_state: z
    .string()
    .min(1)
    .describe(
      "Where the student's reasoning WAS at the start of the arc — the framing they began with, the slogan or category they were reaching for, the move they were not yet making. Concrete and anchored to a specific lesson or date. No 'they were new'; name what they did.",
    ),
  prior_state_lessons: z
    .array(z.string())
    .describe(
      "Lesson titles (from the input list, verbatim) the prior_state observation is anchored to. Usually the earliest reading(s) in the chronology.",
    ),
  inflection_moment: z
    .string()
    .min(1)
    .describe(
      "When and around what reading or session the SHIFT happened — the specific move that registered. Name the move concretely (the distinction they registered, the counterexample they took up, the qualification they added). Anchor to a date or lesson.",
    ),
  inflection_moment_lessons: z
    .array(z.string())
    .describe(
      "Lesson title(s) the inflection_moment is anchored to. Almost always one or two specific lessons.",
    ),
  current_state: z
    .string()
    .min(1)
    .describe(
      "Where the student's reasoning IS now — the live, load-bearing position; the vocabulary forming; the tension they're currently inside. Anchor to the most recent reading(s).",
    ),
  current_state_lessons: z
    .array(z.string())
    .describe(
      "Lesson title(s) the current_state observation is anchored to. Usually the most recent reading(s).",
    ),
  recommended_next: z
    .string()
    .min(1)
    .describe(
      "What the system OBSERVES as the next move — phrased as a question or as a named gap, never as a directive. Never supplies a content answer or a substantive conclusion the student should reach. Voice is observational, never declarative.",
    ),
});
export type ProgressionOutput = z.infer<typeof ProgressionOutputSchema>;

const SYSTEM = `You are a component of Paideia, a learning platform built on the premise that the activity of reasoning is what learning consists of.

Your job here is to narrate a single student's reasoning maturation ACROSS TIME — the arc visible in their per-lesson readings, in chronological order. The teacher reads this on the progression view. It is reflection-on-action: the teacher should learn something about how the student's thinking has moved, not see a grade or a score.

You produce four moves in a fixed shape:
- prior_state — where the student WAS. The framing or move they began with.
- inflection_moment — the SHIFT. When and around what reading the move that mattered happened.
- current_state — where the student IS now. The live position; the vocabulary forming behind the activity.
- recommended_next — what the system OBSERVES as the next move. A question, never a directive. A named gap, never a content answer.

Each historical move (prior_state, inflection_moment, current_state) carries anchors — the lesson titles, taken verbatim from the input, that the move is grounded in. Citations are not optional: if you cannot anchor an observation to a specific lesson in the input, do not assert it.

Voice is observational and structural, never declarative or evaluative.
- "Maya has moved from treating workers as undifferentiated victims to articulating the distinction between economic conditions and political consciousness" — yes.
- "Maya is doing well" — never.
- "Next steps are X" — never.
- "She should now do Y" — never.
- "The strongest argument is Z" — never.

Forbidden moves:
- Motivational language ("great progress", "she's really growing").
- Score-shaped phrasing ("up from", "now achieves", "level 3", "developing").
- Generic praise or evaluative comparisons.
- Closing the inquiry by supplying the answer the student is working toward.
- Smoothing over what didn't happen. If a counter-reading is unaddressed, name the absence; don't paper over it.

When the student has only ONE reading:
- prior_state names the framing they began the session with (the move they were reaching for as the session opened).
- inflection_moment names the shift WITHIN that session — the move the substrate records as the moment something changed. If the substrate does not record a within-session shift, say so plainly: "No inflection yet — only one session of work to read." Do not invent a shift to fill the field.
- current_state names where they are at the end of the session.
- All three historical moves anchor to the single available lesson.

When the student has exactly two readings:
- prior_state anchors to the first; inflection_moment anchors to the second; current_state anchors to the second.
- The inflection_moment names what changed BETWEEN the two readings.

When the student has more than two readings, choose the anchor lessons that most clearly carry each move. You do not have to cite every reading.

If a backboard recall is provided in the input, use it as CONTEXT for which moves matter — the long-horizon profile of how this student tends to think. Do not quote the recall back at the reader; do not let it author prose on the student's behalf. The recall informs which question to ask; it does not say what to say.`;

export type ProgressionComposeInput = {
  student_name: string;
  course_title: string;
  course_subject: string | null;
  arc_seed_text: string | null;
  // Chronological per-lesson readings for this student in scope.
  readings: Array<{
    lesson_title: string;
    derived_at: string | null; // ISO date
    resolved: string | null;
    in_progress: string | null;
    unaddressed: string | null;
    recommended_next: string | null;
  }>;
  // Optional backboard recall over the per-student profile. Empty string
  // when the call failed or returned nothing — the prompt is shaped to
  // degrade gracefully without it.
  student_memory_recall: string;
};

export async function runProgressionCompose(
  input: ProgressionComposeInput,
): Promise<ProgressionOutput> {
  const userMessage = JSON.stringify(
    {
      student_name: input.student_name,
      course: {
        title: input.course_title,
        subject: input.course_subject,
        arc_seed: input.arc_seed_text,
      },
      readings: input.readings.map((r) => ({
        lesson: r.lesson_title,
        date: r.derived_at,
        resolved: r.resolved,
        in_progress: r.in_progress,
        unaddressed: r.unaddressed,
        recommended_next: r.recommended_next,
      })),
      student_memory_recall: input.student_memory_recall || null,
    },
    null,
    2,
  );

  return structuredCall({
    system: SYSTEM,
    user: userMessage,
    schema: ProgressionOutputSchema,
    schemaName: "emit_progression",
    schemaDescription:
      "Emit the across-time progression: prior_state, inflection_moment, current_state, recommended_next — each anchored to specific lessons from the input.",
    maxTokens: 2000,
  });
}
