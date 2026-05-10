"use server";

// submitTurn — the student writes prose; we capture it, run the bounded
// LLM call, apply the substrate delta, persist composed_view + next_gap
// on the turn row, and revalidate the lesson page.
//
// Failure-isolation invariant: raw_prose is written to `turns` BEFORE any
// LLM call. If the LLM fails, the prose is preserved; the turn just
// renders without a composed view or surfaced gap. The student can retry.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { runTurnCall } from "@/lib/llm/turn-call";
import {
  applyTurnDelta,
  patchCites,
  patchGapTargets,
} from "@/lib/substrate/applier";
import {
  retrieveStudentMemory,
  retrieveLessonContext,
  writeStudentReadingMemory,
} from "@/lib/backboard";

type SessionRow = {
  id: string;
  lesson_id: string;
  student_id: string;
  working_text: { notes?: string; draft?: string; reflection?: string } | null;
};

export type WritingMode = "notes" | "draft" | "reflection";
const WRITING_MODES = ["notes", "draft", "reflection"] as const;
function isWritingMode(s: string): s is WritingMode {
  return (WRITING_MODES as readonly string[]).includes(s);
}

// saveWorkingText — debounced autosave from the writing surface. Patches
// the (session, mode) cell of sessions.working_text. No LLM call; pure
// persistence so reload doesn't lose work. Idempotent.
export async function saveWorkingText(formData: FormData): Promise<void> {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const sessionId = String(formData.get("session_id") ?? "").trim();
  const modeRaw = String(formData.get("mode") ?? "").trim();
  const text = String(formData.get("text") ?? "");
  if (!sessionId) throw new Error("session_id required");
  if (!isWritingMode(modeRaw)) throw new Error(`invalid mode: ${modeRaw}`);

  // Defense in depth — verify ownership before patching.
  const rows = (await sql`
    select student_id from sessions where id = ${sessionId}
  `) as unknown as Array<{ student_id: string }>;
  if (!rows[0] || rows[0].student_id !== user.student_id) {
    throw new Error("Session not found or not yours");
  }

  // jsonb_set patches a single key without touching the others. If the
  // column is somehow null (shouldn't happen given the schema default),
  // coalesce to the default shape first.
  await sql`
    update sessions
    set working_text = jsonb_set(
      coalesce(working_text, jsonb_build_object('notes','','draft','','reflection','')),
      ${`{${modeRaw}}`},
      to_jsonb(${text}::text),
      true
    ),
    updated_at = now()
    where id = ${sessionId}
  `;

  // No revalidatePath — autosave is silent. The surface keeps its own
  // dirty state client-side. Page revalidation only happens on Save &
  // Reflect (submitTurn below).
}

type LessonRow = {
  id: string;
  title: string;
  prompt: string;
  reasoning_shape: string | null;
  expected_kinds: string[] | null;
  anticipated_gaps: string[] | null;
};

type NodeRow = {
  id: string;
  role: string;
  kind: string;
  content: string;
  status: string;
};

type EdgeRow = {
  id: string;
  src_id: string;
  dst_id: string;
  relation: string;
  kind: string;
};

type PriorTurn = { raw_prose: string };

export async function submitTurn(formData: FormData): Promise<void> {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const sessionId = String(formData.get("session_id") ?? "").trim();
  const modeRaw = String(formData.get("mode") ?? "notes").trim();
  if (!sessionId) throw new Error("session_id required");
  if (!isWritingMode(modeRaw)) throw new Error(`invalid mode: ${modeRaw}`);
  const mode: WritingMode = modeRaw;

  // Verify ownership AND read the source-of-truth working_text in one
  // round-trip. We submit what's persisted, not what the form posted —
  // any drift between the client and the DB is resolved in the DB's favor.
  const sessionRows = (await sql`
    select id, lesson_id, student_id, working_text
    from sessions where id = ${sessionId}
  `) as unknown as SessionRow[];
  const session = sessionRows[0];
  if (!session || session.student_id !== user.student_id) {
    throw new Error("Session not found or not yours");
  }

  const rawProse = String(session.working_text?.[mode] ?? "").trim();
  if (!rawProse) {
    // Nothing to reflect on. No turn, no error.
    revalidatePath(`/lesson/${sessionId}`);
    return;
  }

  // 1. Capture raw prose FIRST. Even if the LLM call fails, the student's
  //    input is on disk and visible in the think-out-loud panel.
  const turnId = `turn_${randomUUID().slice(0, 12)}`;
  await sql`
    insert into turns (id, session_id, raw_prose, composed_view, next_gap)
    values (${turnId}, ${sessionId}, ${rawProse}, null, null)
  `;

  // 2. Load lesson context + substrate slice + prior turns summary.
  const lessonRows = (await sql`
    select id, title, prompt, reasoning_shape, expected_kinds, anticipated_gaps
    from lessons where id = ${session.lesson_id}
  `) as unknown as LessonRow[];
  const lesson = lessonRows[0];
  if (!lesson) throw new Error("Lesson not found");

  const nodes = (await sql`
    select id, role, kind, content, status
    from nodes where session_id = ${sessionId}
    order by created_at asc
  `) as unknown as NodeRow[];

  const edges = (await sql`
    select id, src_id, dst_id, relation, kind
    from edges where session_id = ${sessionId}
  `) as unknown as EdgeRow[];

  const priorTurns = (await sql`
    select raw_prose
    from turns
    where session_id = ${sessionId} and id != ${turnId}
    order by created_at desc
    limit 3
  `) as unknown as PriorTurn[];

  // 3. Backboard retrieval — parallel. Each call returns "" on failure
  //    (per the wrapper) so the LLM call always proceeds. The query is the
  //    student's new prose, lightly framed.
  const retrievalQuery = `In the lesson "${lesson.title}", the student is working on: ${truncate(rawProse, 400)}`;
  const [memoryRecall, lessonRecall] = await Promise.all([
    retrieveStudentMemory(user.student_id, retrievalQuery).catch((e) => {
      console.error("[submitTurn] retrieveStudentMemory failed:", e);
      return "";
    }),
    retrieveLessonContext(session.lesson_id, retrievalQuery).catch((e) => {
      console.error("[submitTurn] retrieveLessonContext failed:", e);
      return "";
    }),
  ]);

  // 4. Bounded LLM call. On failure: log, leave the turn without composed
  //    view or gap; the page will render what's there.
  let output;
  try {
    output = await runTurnCall({
      lesson_prompt: lesson.prompt,
      reasoning_shape: lesson.reasoning_shape,
      expected_kinds: lesson.expected_kinds,
      anticipated_gaps: lesson.anticipated_gaps,
      substrate_nodes: nodes,
      substrate_edges: edges,
      prior_turns: priorTurns.reverse(), // chronological for the prompt
      raw_prose: rawProse,
      retrieved_student_memory: memoryRecall,
      retrieved_lesson_context: lessonRecall,
    });
  } catch (err) {
    console.error("[submitTurn] LLM call failed:", err);
    revalidatePath(`/lesson/${sessionId}`);
    return;
  }

  // 4. Apply substrate delta. Returns the tmp_id → real_id map.
  const { tmp_to_real } = await applyTurnDelta(sessionId, output);

  // 5. Patch composed_view cites and next_gap targets to use real ids.
  const composedView = patchCites(output.composed_view, tmp_to_real);
  const patchedGap = patchGapTargets(output.next_gap, tmp_to_real);

  // 6. Persist on the turn row. The lesson page reads next_gap with shape
  //    { prompt, target_node_ids, type }; map move_type → type so the
  //    existing renderer keeps working.
  const nextGapForStorage = patchedGap
    ? {
        prompt: patchedGap.prompt_to_student,
        target_node_ids: patchedGap.target_node_ids,
        type: patchedGap.move_type,
      }
    : null;

  await sql`
    update turns
    set composed_view = ${composedView ? sql.json(composedView) : null},
        next_gap = ${nextGapForStorage ? sql.json(nextGapForStorage) : null}
    where id = ${turnId}
  `;

  // 7. Fire-and-forget memory write to the per-student backboard assistant.
  //    The composed view + the student's prose become the semantic record
  //    of what they worked through; backboard's memory="Auto" extraction
  //    will distill it for future retrieval. Awaited so Next.js doesn't
  //    cut the promise on response — adds 1-2s but keeps the trace honest.
  const memorySummary = composedView
    ? `In the lesson "${lesson.title}", the student wrote: "${truncate(rawProse, 400)}". The system noticed: ${composedView.sentences.map((s) => s.text).join(" ")}${nextGapForStorage ? ` The next gap: ${nextGapForStorage.prompt}` : ""}`
    : `In the lesson "${lesson.title}", the student wrote: "${truncate(rawProse, 400)}"${nextGapForStorage ? `. The next gap surfaced: ${nextGapForStorage.prompt}` : ""}`;
  try {
    await writeStudentReadingMemory(user.student_id, lesson.title, memorySummary);
  } catch (err) {
    console.error("[submitTurn] writeStudentReadingMemory failed:", err);
  }

  revalidatePath(`/lesson/${sessionId}`);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}
