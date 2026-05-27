"use server";

// Teacher-side server actions. v0 discipline:
//
// - Writes go directly to Postgres via the sql template tag (substrate is
//   ground truth; nothing here calls out to Backboard or any LLM).
// - revalidatePath after every successful write — no optimistic UI yet.
// - Inputs that come from form fields are coerced once; everything stored
//   is what the teacher actually typed (preserve provenance).
// - Block edits patch a single block by id (read-modify-write of the
//   blocks jsonb). Cheaper than positional patching for v0; if concurrent
//   block editing becomes a thing, switch to a JSON path patch.
// - The lessons.prompt column is denormalized from the prompt block so
//   the existing student page (`/lesson/[session_id]`) keeps rendering
//   the right question without needing to read blocks. The block is
//   canonical; the column mirrors it on save.

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import {
  writeTeacherNote,
  writeStudentReadingMemory,
  writeLessonReading,
  getOrCreateScope,
  getBackboardClient,
  retrieveStudentMemory,
} from "@/lib/backboard";
import { runReadingCompose } from "@/lib/llm/reading-composer";
import { runProgressionCompose } from "@/lib/llm/progression-composer";
import {
  runTeacherLessonChat,
  type ChatMessage,
  type ChatSuggestedAction,
} from "@/lib/llm/teacher-lesson-chat";
import { runClassSummaryCompose } from "@/lib/llm/class-summary-composer";
import {
  type BlockType,
  type TypedBlock,
  type Doc,
  type VideoContent,
  type AISegment,
  type AIGeneratedContent,
  DocSchema,
  VideoContentSchema,
  AISegmentSchema,
  parseOrMigrateBlocks,
} from "@/lib/lesson-blocks";

// Re-export the canonical types from @/lib/lesson-blocks for callers that
// import them from this module today. New code should import from the
// schemas module directly.
export type { BlockType, TypedBlock as Block } from "@/lib/lesson-blocks";

// teacher_notes shape: { [blockId]: noteText }. Notes are keyed by block
// id, not by position, so reordering or renaming does not lose them.
// Deleting a block leaves an orphan note (cheap to ignore on read,
// recoverable if the block is restored).
export type TeacherNotes = Record<string, string>;

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

// The postgres driver's sql.json typing is a recursive JSONValue union
// that doesn't match a TS discriminated union, even though the runtime
// value is plain JSON. Cast through unknown at the call sites — the
// helper centralizes the cast so the rest of the file stays readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asJson<T>(value: T): any {
  return value as unknown;
}

// createCourse — invoked from /teacher/courses/new. Inserts and drops the
// teacher onto the lesson planner; the new course is the natural default
// there. (There is no course-detail view yet — the course exists as a
// container for lessons; navigation to it happens through the lesson list.)
export async function createCourse(formData: FormData): Promise<void> {
  const teacherId = "teacher_k"; // v0: only one teacher in seed.
  const id = newId("course");
  const title = str(formData, "title").trim();
  const subject = str(formData, "subject").trim();
  const term = str(formData, "term").trim();
  const yearGroup = str(formData, "year_group").trim();
  const arcSeed = str(formData, "arc_seed_text").trim();

  if (!title) {
    throw new Error("Course title is required");
  }

  await sql`
    insert into courses (id, teacher_id, title, subject, term, year_group, arc_seed_text)
    values (${id}, ${teacherId}, ${title}, ${subject || null}, ${term || null}, ${yearGroup || null}, ${arcSeed || null})
  `;

  revalidatePath("/teacher");
  redirect("/teacher/lessons/new");
}

// addLesson — form action. Creates a new lesson under a course with a
// minimal block sequence (Context · Prompt · Response). Redirects to the
// composer so the teacher's next move is filling in the blocks.
export async function addLesson(formData: FormData): Promise<void> {
  const teacherId = "teacher_k"; // v0: only one teacher in seed.
  const courseId = str(formData, "course_id").trim();
  const title = str(formData, "title").trim() || "Untitled lesson";
  const prompt = str(formData, "prompt").trim();
  const context = str(formData, "context").trim();

  if (!courseId) throw new Error("course_id required");

  const id = newId("lesson");

  // Only create blocks the teacher actually authored.
  //   - Context: only if they filled the optional context field. An empty
  //     Context block confuses the composer — it looks like content the
  //     teacher forgot to write.
  //   - Prompt: always (the form requires it).
  //   - Response: never auto-created. The student's response lives in
  //     `turns.raw_prose` + `nodes` — not in lesson.blocks. Surfacing a
  //     "Response" block in the composer suggested the teacher should
  //     edit it, which is wrong.
  const blocks: TypedBlock[] = [];
  if (context) {
    blocks.push({
      id: newId("blk"),
      type: "context",
      content: context,
      meta: "Frame for the student · edit before publish",
    });
  }
  blocks.push({
    id: newId("blk"),
    type: "prompt",
    content: prompt,
    meta: "Students see this as the lesson's central question",
  });

  await sql`
    insert into lessons (id, teacher_id, course_id, title, prompt, blocks, teacher_notes)
    values (
      ${id},
      ${teacherId},
      ${courseId},
      ${title},
      ${prompt || ""},
      ${sql.json(asJson(blocks))},
      ${sql.json({})}
    )
  `;

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/teacher`);
  redirect(`/teacher/lessons/${id}/edit`);
}

// saveLessonBlocks — replace the lesson's blocks jsonb wholesale. Kept
// because addLesson and any future bulk-rewrite paths still want it.
export async function saveLessonBlocks(
  lessonId: string,
  blocks: TypedBlock[],
): Promise<void> {
  const promptBlock = blocks.find((b) => b.type === "prompt");
  const promptText = promptBlock?.content ?? "";

  await sql`
    update lessons
    set blocks = ${sql.json(asJson(blocks))},
        prompt = ${promptText}
    where id = ${lessonId}
  `;

  revalidatePath(`/teacher/lessons/${lessonId}/edit`, "page");
}

// Flatten a rich Doc to plain text for backboard upload. Provenance is
// preserved in Postgres; backboard's index only sees text, with AI
// segments prefixed by ◆ so retrieved chunks carry the authorship signal.
function docToPlainText(doc: Doc): string {
  return doc.segments
    .map((s) => {
      if (s.kind === "human") return s.body;
      if (s.sub_kind === "paragraph") return `[◆ AI] ${s.body}`;
      if (s.sub_kind === "chart") return `[◆ AI chart] ${s.caption}`;
      if (s.sub_kind === "diagram") return `[◆ AI diagram] ${s.caption}`;
      return "";
    })
    .filter((t) => t.length > 0)
    .join("\n\n");
}

// Best-effort backboard upload for a lesson's source material. Fire-and-
// forget: on failure we log and proceed.
async function uploadBlockToLessonAssistant(
  lessonId: string,
  blockId: string,
  filename: string,
  body: string,
  source?: string,
): Promise<void> {
  if (body.trim().length === 0) return;
  try {
    const client = getBackboardClient();
    const assistantId = await getOrCreateScope("lesson", lessonId);
    const fullBody = source ? `[source: ${source}]\n\n${body}` : body;
    await client.uploadDocumentToAssistant(assistantId, filename, fullBody);
  } catch (err) {
    console.error(`[uploadBlockToLessonAssistant ${blockId}] failed:`, err);
  }
}

// saveBlockContent — patch a single STRING-content block's content by id.
// Operates on context / prompt / response / ai_generated / quiz only.
// Reading and video have their own dedicated actions because their content
// is structured (Doc / VideoContent), not a string.
//
// Mirrors the prompt block to the lessons.prompt column so the existing
// student page (/lesson/[session_id]) keeps rendering the question.
export async function saveBlockContent(formData: FormData): Promise<void> {
  const lessonId = str(formData, "lessonId");
  const blockId = str(formData, "blockId");
  const content = str(formData, "content");

  if (!lessonId || !blockId) {
    throw new Error("saveBlockContent: lessonId and blockId required");
  }

  const rows = (await sql`
    select blocks from lessons where id = ${lessonId}
  `) as unknown as Array<{ blocks: unknown }>;
  const current = parseOrMigrateBlocks(rows[0]?.blocks);

  // Narrow to the block being edited and reject if it isn't a string-content
  // type. saveReadingDoc / saveVideoContent handle the structured types.
  const target = current.find((b) => b.id === blockId);
  if (!target) {
    throw new Error(`saveBlockContent: block "${blockId}" not found`);
  }
  if (
    target.type === "reading" ||
    target.type === "video" ||
    target.type === "ai_generated"
  ) {
    throw new Error(
      `saveBlockContent: block "${blockId}" is type "${target.type}"; use the dedicated structured-save action (saveReadingDoc / saveVideoContent / saveAIGeneratedSegment)`,
    );
  }

  const next: TypedBlock[] = current.map((b) =>
    b.id === blockId &&
    b.type !== "reading" &&
    b.type !== "video" &&
    b.type !== "ai_generated"
      ? { ...b, content }
      : b,
  );

  const promptBlock = next.find((b) => b.type === "prompt");
  const promptText = promptBlock?.content ?? "";

  await sql`
    update lessons
    set blocks = ${sql.json(asJson(next))},
        prompt = ${promptText}
    where id = ${lessonId}
  `;

  revalidatePath(`/teacher/lessons/${lessonId}/edit`, "page");
}

// saveReadingDoc — replace one reading block's structured Doc content.
// Called by the TipTap editor on debounced save. Validates the Doc via
// Zod before write; uploads a flattened plain-text version to the lesson
// assistant for RAG.
export async function saveReadingDoc(
  lessonId: string,
  blockId: string,
  doc: Doc,
): Promise<void> {
  if (!lessonId || !blockId) {
    throw new Error("saveReadingDoc: lessonId and blockId required");
  }
  const validated = DocSchema.parse(doc);

  const rows = (await sql`
    select blocks from lessons where id = ${lessonId}
  `) as unknown as Array<{ blocks: unknown }>;
  const current = parseOrMigrateBlocks(rows[0]?.blocks);

  const target = current.find((b) => b.id === blockId);
  if (!target) {
    throw new Error(`saveReadingDoc: block "${blockId}" not found`);
  }
  if (target.type !== "reading") {
    throw new Error(
      `saveReadingDoc: block "${blockId}" is type "${target.type}", expected "reading"`,
    );
  }

  const next: TypedBlock[] = current.map((b) =>
    b.id === blockId && b.type === "reading" ? { ...b, content: validated } : b,
  );

  await sql`
    update lessons
    set blocks = ${sql.json(asJson(next))}
    where id = ${lessonId}
  `;

  // Best-effort RAG upload.
  void uploadBlockToLessonAssistant(
    lessonId,
    blockId,
    `reading-${blockId}.txt`,
    docToPlainText(validated),
    target.source,
  );

  revalidatePath(`/teacher/lessons/${lessonId}/edit`, "page");
}

// saveVideoContent — replace one video block's structured content.
export async function saveVideoContent(
  lessonId: string,
  blockId: string,
  content: VideoContent,
): Promise<void> {
  if (!lessonId || !blockId) {
    throw new Error("saveVideoContent: lessonId and blockId required");
  }
  const validated = VideoContentSchema.parse(content);

  const rows = (await sql`
    select blocks from lessons where id = ${lessonId}
  `) as unknown as Array<{ blocks: unknown }>;
  const current = parseOrMigrateBlocks(rows[0]?.blocks);

  const target = current.find((b) => b.id === blockId);
  if (!target) {
    throw new Error(`saveVideoContent: block "${blockId}" not found`);
  }
  if (target.type !== "video") {
    throw new Error(
      `saveVideoContent: block "${blockId}" is type "${target.type}", expected "video"`,
    );
  }

  const next: TypedBlock[] = current.map((b) =>
    b.id === blockId && b.type === "video" ? { ...b, content: validated } : b,
  );

  await sql`
    update lessons
    set blocks = ${sql.json(asJson(next))}
    where id = ${lessonId}
  `;

  // Upload transcript + any AI summary to the lesson assistant for RAG.
  const body = [
    validated.transcript ?? "",
    validated.ai_summary ? `[◆ AI summary] ${validated.ai_summary.body}` : "",
  ]
    .filter((t) => t.length > 0)
    .join("\n\n");
  if (body.length > 0) {
    void uploadBlockToLessonAssistant(
      lessonId,
      blockId,
      `video-${blockId}.txt`,
      body,
      target.source ?? validated.url,
    );
  }

  revalidatePath(`/teacher/lessons/${lessonId}/edit`, "page");
}

// saveAIGeneratedSegment — replace the segment inside one ai_generated
// block. Accepts a Zod-validated AISegment, or null to clear back to
// the empty state. Called by the inline AIGeneratedBlockEditor after a
// successful generate-segment API call, or after the teacher edits an
// AI-paragraph's body inline.
//
// Provenance: the segment's `generation` stamp comes from the route
// handler that did the LLM call (or, for chat-accepted segments, from
// applyChatSuggestedAction). This action does NOT mint or mutate
// generation metadata — it just persists whatever the caller provides.
export async function saveAIGeneratedSegment(
  lessonId: string,
  blockId: string,
  segment: AISegment | null,
): Promise<void> {
  if (!lessonId || !blockId) {
    throw new Error("saveAIGeneratedSegment: lessonId and blockId required");
  }
  // Validate the new segment shape (or accept null).
  const validatedSegment =
    segment === null ? null : AISegmentSchema.parse(segment);

  const rows = (await sql`
    select blocks from lessons where id = ${lessonId}
  `) as unknown as Array<{ blocks: unknown }>;
  const current = parseOrMigrateBlocks(rows[0]?.blocks);

  const target = current.find((b) => b.id === blockId);
  if (!target) {
    throw new Error(`saveAIGeneratedSegment: block "${blockId}" not found`);
  }
  if (target.type !== "ai_generated") {
    throw new Error(
      `saveAIGeneratedSegment: block "${blockId}" is type "${target.type}", expected "ai_generated"`,
    );
  }

  const nextContent: AIGeneratedContent = { segment: validatedSegment };
  const next: TypedBlock[] = current.map((b) =>
    b.id === blockId && b.type === "ai_generated"
      ? { ...b, content: nextContent }
      : b,
  );

  await sql`
    update lessons
    set blocks = ${sql.json(asJson(next))}
    where id = ${lessonId}
  `;

  // Backboard upload — flatten the segment to plain text the lesson
  // assistant can index. Paragraph body, chart caption, or diagram
  // caption. Empty segment skips upload.
  if (validatedSegment) {
    const body =
      validatedSegment.sub_kind === "paragraph"
        ? `[◆ AI] ${validatedSegment.body}`
        : validatedSegment.sub_kind === "chart"
          ? `[◆ AI chart] ${validatedSegment.caption}`
          : `[◆ AI diagram] ${validatedSegment.caption}`;
    void uploadBlockToLessonAssistant(
      lessonId,
      blockId,
      `ai-${blockId}.txt`,
      body,
      target.source,
    );
  }

  revalidatePath(`/teacher/lessons/${lessonId}/edit`, "page");
}

// saveVideoUrl — form-action wrapper around saveVideoContent for the
// teacher composer. The plan-view's video block is a single URL paste
// field; this action reads the URL, derives the provider, and delegates
// to the validating action. Empty URL is a no-op (the block stays in its
// stub state). Provider is inferred from the URL host so the teacher
// never picks it from a dropdown.
export async function saveVideoUrl(formData: FormData): Promise<void> {
  const lessonId = str(formData, "lessonId");
  const blockId = str(formData, "blockId");
  const url = str(formData, "url").trim();

  if (!lessonId || !blockId) {
    throw new Error("saveVideoUrl: lessonId and blockId required");
  }
  if (url.length === 0) {
    revalidatePath(`/teacher/lessons/${lessonId}/edit`, "page");
    return;
  }

  const provider: VideoContent["provider"] = /youtube\.com|youtu\.be/i.test(url)
    ? "youtube"
    : /vimeo\.com/i.test(url)
      ? "vimeo"
      : "mp4";

  await saveVideoContent(lessonId, blockId, { url, provider });
}

// reorderBlock — move the block at fromIndex to toIndex within the lesson's
// blocks array. Called by the drag-reorder client component on drop.
export async function reorderBlock(
  lessonId: string,
  blockId: string,
  toIndex: number,
): Promise<void> {
  if (!lessonId || !blockId) {
    throw new Error("reorderBlock: lessonId and blockId required");
  }

  const rows = (await sql`
    select blocks from lessons where id = ${lessonId}
  `) as unknown as Array<{ blocks: unknown }>;
  const current = parseOrMigrateBlocks(rows[0]?.blocks);

  const fromIndex = current.findIndex((b) => b.id === blockId);
  if (fromIndex === -1) {
    throw new Error(`reorderBlock: block "${blockId}" not found`);
  }
  const clampedTo = Math.max(0, Math.min(toIndex, current.length - 1));
  if (clampedTo === fromIndex) return;

  const next = [...current];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(clampedTo, 0, moved);

  await sql`
    update lessons
    set blocks = ${sql.json(asJson(next))}
    where id = ${lessonId}
  `;

  revalidatePath(`/teacher/lessons/${lessonId}/edit`, "page");
}

// deleteBlock — remove a block from the lesson's blocks array, and clean
// up any orphaned teacher_note for that block id. The teacher_notes shape
// is { [blockId]: noteText }, so deletion is just key omission.
export async function deleteBlock(formData: FormData): Promise<void> {
  const lessonId = str(formData, "lessonId");
  const blockId = str(formData, "blockId");

  if (!lessonId || !blockId) {
    throw new Error("deleteBlock: lessonId and blockId required");
  }

  const rows = (await sql`
    select blocks, teacher_notes from lessons where id = ${lessonId}
  `) as unknown as Array<{ blocks: unknown; teacher_notes: TeacherNotes | null }>;
  const current = parseOrMigrateBlocks(rows[0]?.blocks);
  const existingNotes = rows[0]?.teacher_notes ?? {};

  const next = current.filter((b) => b.id !== blockId);
  if (next.length === current.length) {
    throw new Error(`deleteBlock: block "${blockId}" not found`);
  }

  // Strip the note keyed to the deleted block.
  const nextNotes: TeacherNotes = { ...existingNotes };
  delete nextNotes[blockId];

  // Keep lessons.prompt in sync if we removed the prompt block.
  const promptBlock = next.find((b) => b.type === "prompt");
  const promptText = promptBlock?.content ?? "";

  await sql`
    update lessons
    set blocks = ${sql.json(asJson(next))},
        teacher_notes = ${sql.json(asJson(nextNotes))},
        prompt = ${promptText}
    where id = ${lessonId}
  `;

  revalidatePath(`/teacher/lessons/${lessonId}/edit`, "page");
}

// composeClassSummary — server action. Triggered from the teacher's
// dashboard "Refresh →" button on the ◆ Class summary bar. Pulls every
// enrolled student's latest reading + stage, runs the class-summary
// composer, persists on courses.last_class_summary so subsequent loads
// don't re-trigger.
//
// Best-effort backboard write: the summary lands as a teacher_note on
// Mr. K's per-teacher assistant so cross-class observations accumulate.
export async function composeClassSummary(formData: FormData): Promise<void> {
  const courseId = str(formData, "course_id");
  if (!courseId) throw new Error("composeClassSummary: course_id required");

  const courseRows = (await sql`
    select id, title, subject, arc_seed_text, teacher_id
    from courses where id = ${courseId}
  `) as unknown as Array<{
    id: string;
    title: string;
    subject: string | null;
    arc_seed_text: string | null;
    teacher_id: string;
  }>;
  const course = courseRows[0];
  if (!course) throw new Error("composeClassSummary: course not found");

  const cohort = (await sql`
    select
      s.name,
      s.stage,
      s.summary,
      r.derived_content
    from course_enrollments e
    join students s on s.id = e.student_id
    left join readings r on r.student_id = s.id
      and r.lesson_id in (select id from lessons where course_id = ${courseId})
    where e.course_id = ${courseId}
    order by s.name asc
  `) as unknown as Array<{
    name: string;
    stage: string | null;
    summary: string | null;
    derived_content: {
      resolved?: string;
      in_progress?: string;
      unaddressed?: string;
      recommended_next?: string;
    } | null;
  }>;

  if (cohort.length === 0) {
    throw new Error("composeClassSummary: no enrolled students");
  }

  const composed = await runClassSummaryCompose({
    course_title: course.title,
    course_subject: course.subject,
    arc_seed_text: course.arc_seed_text,
    students: cohort.map((s) => ({
      name: s.name,
      stage: s.stage,
      summary: s.summary,
      reading_resolved: s.derived_content?.resolved ?? null,
      reading_in_progress: s.derived_content?.in_progress ?? null,
      reading_unaddressed: s.derived_content?.unaddressed ?? null,
    })),
  });

  await sql`
    update courses
    set last_class_summary = ${sql.json(composed)},
        last_class_summary_at = now()
    where id = ${courseId}
  `;

  // Fire-and-forget: the summary becomes a memory on Mr. K's per-teacher
  // assistant. Cross-week patterns accumulate without polluting the
  // student-facing surface. Best-effort.
  try {
    await writeTeacherNote(course.teacher_id, composed.summary, {
      target_type: "course",
      target_id: courseId,
      kind: "class_summary",
      recurring_pattern: composed.recurring_pattern ?? undefined,
    });
  } catch (err) {
    console.error("[composeClassSummary] backboard write failed:", err);
  }

  revalidatePath("/teacher");
}

// composeReading — server action. Triggered from the teacher's student
// detail page ("Refresh reading"). Pulls the student's substrate for the
// lesson, runs the reading-composer LLM call, upserts the result into
// readings.derived_content. Also writes the composed reading to the
// per-lesson backboard assistant (cohort-readable) and to the per-student
// assistant via memory="Auto" (long-horizon profile).
export async function composeReading(formData: FormData): Promise<void> {
  const studentId = str(formData, "student_id");
  const lessonId = str(formData, "lesson_id");
  if (!studentId || !lessonId) {
    throw new Error("composeReading: student_id and lesson_id required");
  }

  // Resolve session(s) for this student × lesson. v0: there's exactly one.
  const sessionRows = (await sql`
    select id from sessions
    where student_id = ${studentId} and lesson_id = ${lessonId}
    limit 1
  `) as unknown as Array<{ id: string }>;
  if (sessionRows.length === 0) {
    throw new Error("composeReading: no session for that student × lesson");
  }
  const sessionId = sessionRows[0].id;

  // Load lesson + substrate.
  const lessonRows = (await sql`
    select id, title, prompt, reasoning_shape, expected_kinds, anticipated_gaps
    from lessons where id = ${lessonId}
  `) as unknown as Array<{
    id: string;
    title: string;
    prompt: string;
    reasoning_shape: string | null;
    expected_kinds: string[] | null;
    anticipated_gaps: string[] | null;
  }>;
  const lesson = lessonRows[0];
  if (!lesson) throw new Error("composeReading: lesson not found");

  const studentRows = (await sql`
    select name from students where id = ${studentId}
  `) as unknown as Array<{ name: string }>;
  const studentName = studentRows[0]?.name ?? "this student";

  const nodes = (await sql`
    select id, role, kind, content, status
    from nodes where session_id = ${sessionId}
    order by created_at asc
  `) as unknown as Array<{ id: string; role: string; kind: string; content: string; status: string }>;

  const edges = (await sql`
    select src_id, dst_id, relation, kind
    from edges where session_id = ${sessionId}
  `) as unknown as Array<{ src_id: string; dst_id: string; relation: string; kind: string }>;

  if (nodes.length === 0) {
    throw new Error("composeReading: substrate is empty — there's nothing to compose from");
  }

  // Run the LLM call.
  const composed = await runReadingCompose({
    student_name: studentName,
    lesson_title: lesson.title,
    lesson_prompt: lesson.prompt,
    reasoning_shape: lesson.reasoning_shape,
    substrate_nodes: nodes,
    substrate_edges: edges,
  });

  // Upsert into readings. Preserve teacher_annotations if a row exists.
  const readingId = `reading_${studentId}_${lessonId}`;
  await sql`
    insert into readings (id, student_id, lesson_id, derived_content, derived_at, status)
    values (${readingId}, ${studentId}, ${lessonId}, ${sql.json(composed)}, now(), 'fresh')
    on conflict (student_id, lesson_id) do update
      set derived_content = excluded.derived_content,
          derived_at = excluded.derived_at,
          status = 'fresh'
  `;

  // Backboard writes — both fire-and-forget. The lesson assistant carries
  // the cohort-visible reading (filterable client-side by metadata.type);
  // the student assistant absorbs the reading as a memory="Auto" turn so
  // future gap-surface calls can recall what they worked through.
  try {
    await Promise.all([
      writeLessonReading(lessonId, studentId, composed),
      writeStudentReadingMemory(
        studentId,
        lesson.title,
        `Composed reading for ${studentName}: resolved — ${composed.resolved} | in progress — ${composed.in_progress} | unaddressed — ${composed.unaddressed} | recommended next — ${composed.recommended_next}`,
      ),
    ]);
  } catch (err) {
    console.error("[composeReading] backboard writes failed:", err);
  }

  revalidatePath(`/teacher/student/${studentId}`);
}

// submitAnnotation — invoked from /teacher/student/[student_id]. The
// teacher writes an invitation (a question, an observation) anchored to
// some student artifact. Inserts into progression_annotations; the student
// will see it on their progression view. Body is required; excerpt is
// optional context the teacher pasted in. Defaults: target_type=reading,
// status=open. Status flips to 'received' when the student opens the page.
export async function submitAnnotation(formData: FormData): Promise<void> {
  const teacherId = "teacher_k"; // v0: only one teacher in seed.
  const studentId = str(formData, "student_id");
  const targetType = (str(formData, "target_type") || "reading") as
    | "session"
    | "turn"
    | "reading"
    | "artifact";
  const targetId = str(formData, "target_id");
  const excerpt = str(formData, "excerpt").trim();
  const body = str(formData, "body").trim();

  if (!studentId || !targetId || !body) {
    throw new Error("submitAnnotation: student_id, target_id, body required");
  }

  const id = newId("ann");

  await sql`
    insert into progression_annotations
      (id, teacher_id, student_id, target_type, target_id, excerpt, body, status)
    values (
      ${id},
      ${teacherId},
      ${studentId},
      ${targetType},
      ${targetId},
      ${excerpt || null},
      ${body},
      'open'
    )
  `;

  // Write the annotation to backboard memory so it's retrievable for both
  // sides downstream. Two writes in parallel:
  //   - per-teacher: a teacher_note tagged with student + target so Mr. K's
  //     memory accumulates a record of what he's asked across the cohort.
  //   - per-student: a memory="Auto" turn on the student's assistant so
  //     the student profile remembers the question — useful when the
  //     student opens a future session and the gap-surface call retrieves
  //     "Mr. K previously asked you about X."
  // Both are best-effort; failures don't block the action.
  await Promise.all([
    writeTeacherNote(teacherId, body, {
      target_type: targetType,
      target_id: targetId,
      student_id: studentId,
      excerpt: excerpt || undefined,
      annotation_id: id,
    }),
    writeStudentReadingMemory(
      studentId,
      `annotation on ${targetType} ${targetId}`,
      `Mr. Okafor asked: ${body}${excerpt ? ` (anchored to: "${excerpt}")` : ""}`,
    ),
  ]);

  revalidatePath(`/teacher/student/${studentId}`);
}

// composeStudentProgression — server action. Triggered from
// /progression/[student_id] ("Refresh →"). Pulls the student's readings
// in scope (the active course, optionally narrowed to one lesson),
// fetches a backboard recall over the per-student profile, runs the
// progression composer, and persists the result to progressions.
//
// Scope: lesson_id = null → course-wide; lesson_id = set → that lesson
// only. Both shapes coexist in the progressions table via the
// `nulls not distinct` unique constraint.
//
// The composer call requires at least 2 readings in scope; the caller
// (the page) is responsible for not surfacing Refresh when the empty
// state is rendered, but we double-check here so a stale form submission
// doesn't produce a broken composition.
//
// Backboard recall failure is non-blocking: retrieveStudentMemory
// returns "" on any error, and the composer prompt is shaped to degrade
// gracefully without it. The recall informs which moves matter; it does
// not author prose.
export async function composeStudentProgression(
  formData: FormData,
): Promise<void> {
  const studentId = str(formData, "student_id");
  const courseId = str(formData, "course_id");
  const lessonIdRaw = str(formData, "lesson_id");
  const lessonId = lessonIdRaw ? lessonIdRaw : null;

  if (!studentId) throw new Error("composeStudentProgression: student_id required");
  if (!courseId) throw new Error("composeStudentProgression: course_id required");

  const courseRows = (await sql`
    select id, title, subject, arc_seed_text from courses where id = ${courseId}
  `) as unknown as Array<{
    id: string;
    title: string;
    subject: string | null;
    arc_seed_text: string | null;
  }>;
  const course = courseRows[0];
  if (!course) throw new Error("composeStudentProgression: course not found");

  const studentRows = (await sql`
    select name from students where id = ${studentId}
  `) as unknown as Array<{ name: string }>;
  const studentName = studentRows[0]?.name ?? "this student";

  // Readings in scope. When lesson_id is null we pull every reading the
  // student has in the course; when it's set we pull only that lesson's
  // (which yields a single-reading composition — handled below).
  const readings = lessonId
    ? ((await sql`
        select
          l.title as lesson_title,
          r.derived_at,
          r.derived_content
        from readings r
        join lessons l on l.id = r.lesson_id
        where r.student_id = ${studentId}
          and l.course_id = ${courseId}
          and r.lesson_id = ${lessonId}
        order by r.derived_at asc nulls last
      `) as unknown as Array<{
        lesson_title: string;
        derived_at: Date | null;
        derived_content: {
          resolved?: string;
          in_progress?: string;
          unaddressed?: string;
          recommended_next?: string;
        } | null;
      }>)
    : ((await sql`
        select
          l.title as lesson_title,
          r.derived_at,
          r.derived_content
        from readings r
        join lessons l on l.id = r.lesson_id
        where r.student_id = ${studentId}
          and l.course_id = ${courseId}
        order by r.derived_at asc nulls last
      `) as unknown as Array<{
        lesson_title: string;
        derived_at: Date | null;
        derived_content: {
          resolved?: string;
          in_progress?: string;
          unaddressed?: string;
          recommended_next?: string;
        } | null;
      }>);

  if (readings.length < 1) {
    throw new Error(
      "composeStudentProgression: no readings in scope yet — at least one completed reading is required to compose progression.",
    );
  }

  // Backboard recall over the per-student profile — best-effort.
  const recallQuery = lessonId
    ? `What has ${studentName} been working on, and how has their reasoning moved across sessions in this lesson?`
    : `What has ${studentName} been working on, and how has their reasoning moved across sessions in this course?`;
  const memoryRecall = await retrieveStudentMemory(studentId, recallQuery).catch(
    (e) => {
      console.error("[composeStudentProgression] retrieveStudentMemory failed:", e);
      return "";
    },
  );

  const composed = await runProgressionCompose({
    student_name: studentName,
    course_title: course.title,
    course_subject: course.subject,
    arc_seed_text: course.arc_seed_text,
    readings: readings.map((r) => ({
      lesson_title: r.lesson_title,
      derived_at: r.derived_at ? new Date(r.derived_at).toISOString() : null,
      resolved: r.derived_content?.resolved ?? null,
      in_progress: r.derived_content?.in_progress ?? null,
      unaddressed: r.derived_content?.unaddressed ?? null,
      recommended_next: r.derived_content?.recommended_next ?? null,
    })),
    student_memory_recall: memoryRecall,
  });

  await sql`
    insert into progressions (student_id, course_id, lesson_id, derived_content, derived_at)
    values (${studentId}, ${courseId}, ${lessonId}, ${sql.json(composed)}, now())
    on conflict (student_id, course_id, lesson_id) do update
      set derived_content = excluded.derived_content,
          derived_at = excluded.derived_at
  `;

  // Fire-and-forget: the progression narrative lands as a memory="Auto"
  // turn on the student's per-student assistant. Symmetric with the
  // student-side composeProgression — without this, a teacher-triggered
  // recompose silently bypasses the long-horizon profile, and future
  // recalls (including the next progression compose) never see what was
  // most recently observed.
  try {
    const scopeLabel = lessonId ? "lesson progression" : "course progression";
    await writeStudentReadingMemory(
      studentId,
      `${course.title} — ${scopeLabel}`,
      `Across ${readings.length} session${readings.length === 1 ? "" : "s"} — prior: ${composed.prior_state} | shift: ${composed.inflection_moment} | now: ${composed.current_state} | next: ${composed.recommended_next}`,
    );
  } catch (err) {
    console.error("[composeStudentProgression] backboard write failed:", err);
  }

  revalidatePath(`/progression/${studentId}`);
}

// addBlockToLesson — append a new block to the lesson's blocks jsonb.
// Form-action signature: (FormData) → void. The teacher clicks one of the
// + Reading / + Video / + Prompt / + Quiz / + AI Generated affordances
// at the bottom of the composer; we generate a stable block id, append a
// stub block with the chosen type and an appropriate placeholder meta,
// and revalidate so the teacher lands back on the same surface with the
// new block ready to edit.
export async function addBlockToLesson(formData: FormData): Promise<void> {
  const lessonId = str(formData, "lessonId");
  const type = str(formData, "type") as BlockType;

  if (!lessonId) throw new Error("addBlockToLesson: lessonId required");
  const allowed: BlockType[] = [
    "context",
    "reading",
    "video",
    "prompt",
    "response",
    "ai_generated",
    "quiz",
  ];
  if (!allowed.includes(type)) {
    throw new Error(`addBlockToLesson: unknown type "${type}"`);
  }

  const rows = (await sql`
    select blocks from lessons where id = ${lessonId}
  `) as unknown as Array<{ blocks: unknown }>;
  const current = parseOrMigrateBlocks(rows[0]?.blocks);

  const META_FOR: Record<BlockType, string> = {
    context: "Frame for the student · edit before publish",
    reading: "Source · upload PDF or paste excerpt",
    video: "Clip · paste link or upload transcript",
    prompt: "Question for the student to answer",
    response: "Open · no word limit · think-out-loud enabled",
    ai_generated: "AI-generated · teacher-selected · regeneratable",
    quiz: "Short-answer · think-out-loud enabled per question",
  };

  // Per-type initial content shape. Reading / video / ai_generated have
  // structured content; the others use string content. The schema
  // discriminated union enforces this at parse-time.
  const newBlock: TypedBlock = (() => {
    const id = newId("blk");
    const meta = META_FOR[type];
    switch (type) {
      case "reading":
        return { id, type, content: { segments: [] }, meta };
      case "ai_generated":
        return { id, type, content: { segment: null }, meta };
      case "video":
        return {
          id,
          type,
          content: { url: "", provider: "mp4" as const },
          meta,
        };
      case "context":
      case "prompt":
      case "response":
      case "quiz":
        return { id, type, content: "", meta };
    }
  })();

  const next: TypedBlock[] = [...current, newBlock];

  await sql`
    update lessons
    set blocks = ${sql.json(asJson(next))}
    where id = ${lessonId}
  `;

  revalidatePath(`/teacher/lessons/${lessonId}/edit`, "page");
}

// saveTeacherNote — patch a single block's private note. Form-action
// signature: (FormData) → void.
export async function saveTeacherNote(formData: FormData): Promise<void> {
  const lessonId = str(formData, "lessonId");
  const blockId = str(formData, "blockId");
  const note = str(formData, "note");

  if (!lessonId || !blockId) {
    throw new Error("saveTeacherNote: lessonId and blockId required");
  }

  const rows = (await sql`
    select teacher_notes from lessons where id = ${lessonId}
  `) as unknown as Array<{ teacher_notes: TeacherNotes | null }>;
  const existing = rows[0]?.teacher_notes ?? {};
  const next: TeacherNotes = { ...existing, [blockId]: note };

  await sql`
    update lessons
    set teacher_notes = ${sql.json(asJson(next))}
    where id = ${lessonId}
  `;

  revalidatePath(`/teacher/lessons/${lessonId}/edit`, "page");
}

// deleteLesson — remove a lesson and everything anchored to it.
//
// Cascade behavior (the schema doesn't have ON DELETE CASCADE on most of
// these FKs, so we delete in dependency order inside a transaction):
//   - readings (one per student × lesson) — no FK cascade
//   - sessions (and their nodes / edges / turns via existing CASCADE)
//   - teacher_chats (cascades via FK we added)
//   - the lesson row itself
//
// Out-of-scope cleanups (acceptable for v0):
//   - progression_annotations.target_id is loose text; rows targeting
//     the deleted lesson's sessions / readings will dangle until the
//     teacher prunes them.
//   - artifacts.source_scope may reference the lesson_id; same.
//
// Wraps the deletes in sql.begin so a failure rolls back atomically.
export async function deleteLesson(formData: FormData): Promise<void> {
  const lessonId = str(formData, "lessonId");
  if (!lessonId) throw new Error("deleteLesson: lessonId required");

  // Look up course_id before delete so we can revalidate / redirect to
  // the right place after.
  const rows = (await sql`
    select course_id from lessons where id = ${lessonId}
  `) as unknown as Array<{ course_id: string | null }>;
  if (rows.length === 0) {
    throw new Error(`deleteLesson: lesson "${lessonId}" not found`);
  }
  const courseId = rows[0].course_id;

  await sql.begin(async (tx) => {
    await tx`delete from readings where lesson_id = ${lessonId}`;
    await tx`delete from sessions where lesson_id = ${lessonId}`;
    // teacher_chats cascades on lesson delete, but we do it explicitly
    // so the order is obvious to a reader.
    await tx`delete from teacher_chats where lesson_id = ${lessonId}`;
    await tx`delete from lessons where id = ${lessonId}`;
  });

  if (courseId) revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath("/teacher");
  revalidatePath("/teacher/lessons");
  redirect(courseId ? `/teacher/courses/${courseId}` : "/teacher");
}

// ── Teacher × lesson chat ────────────────────────────────────────────
//
// Stateless server actions wrapping the teacher-lesson-chat composer.
// The chat thread persists in `teacher_chats` keyed on (teacher_id,
// lesson_id). Conversation history is included in each LLM call as
// retrieval context — substrate (lesson title/prompt/blocks) is rebuilt
// fresh every turn so the conversation never becomes source of truth.

// Flatten the lesson's blocks to a compact text form the chat composer
// reads as context. Same shape as docToPlainText but lifted to the
// block level — every block contributes its current content.
function blocksToContextText(blocks: TypedBlock[]): string {
  return blocks
    .map((b, i) => {
      const tag = `${String(i + 1).padStart(2, "0")} [${b.type}]`;
      if (b.type === "reading") {
        const body = b.content.segments
          .map((s) => {
            if (s.kind === "human") return s.body;
            if (s.sub_kind === "paragraph") return `[◆ AI] ${s.body}`;
            if (s.sub_kind === "chart") return `[◆ AI chart] ${s.caption}`;
            return `[◆ AI diagram] ${s.caption}`;
          })
          .filter((t) => t.length > 0)
          .join(" ");
        return `${tag} ${body || "(empty)"}`;
      }
      if (b.type === "video") {
        const v = b.content;
        return `${tag} ${v.provider}: ${v.url || "(no URL)"}${v.transcript ? ` — transcript: ${v.transcript.slice(0, 200)}` : ""}`;
      }
      return `${tag} ${b.content || "(empty)"}`;
    })
    .join("\n");
}

function chatMsgId(): string {
  return `cmsg_${randomUUID().slice(0, 12)}`;
}

async function loadChatHistory(
  teacherId: string,
  lessonId: string,
): Promise<ChatMessage[]> {
  const rows = (await sql`
    select messages from teacher_chats
    where teacher_id = ${teacherId} and lesson_id = ${lessonId}
  `) as unknown as Array<{ messages: ChatMessage[] | null }>;
  return rows[0]?.messages ?? [];
}

async function saveChatHistory(
  teacherId: string,
  lessonId: string,
  messages: ChatMessage[],
): Promise<void> {
  await sql`
    insert into teacher_chats (teacher_id, lesson_id, messages, updated_at)
    values (${teacherId}, ${lessonId}, ${sql.json(asJson(messages))}, now())
    on conflict (teacher_id, lesson_id)
    do update set messages = excluded.messages, updated_at = now()
  `;
}

// sendChatMessage — server action. Appends the user's message to the
// thread, calls the lesson-chat composer, appends the assistant reply,
// persists, and returns the assistant message so the client can render
// it without a full revalidation round-trip.
//
// Important: the LESSON CONTEXT is loaded fresh from Postgres every call
// (lesson title/prompt + current blocks). The chat history is retrieval,
// not source of truth.
export async function sendChatMessage(
  lessonId: string,
  message: string,
): Promise<{ assistant: ChatMessage; history: ChatMessage[] }> {
  if (!lessonId) throw new Error("sendChatMessage: lessonId required");
  const text = message.trim();
  if (text.length === 0) {
    throw new Error("sendChatMessage: message is empty");
  }
  const teacherId = "teacher_k"; // v0: single teacher seed.

  // Pull lesson context fresh.
  const lessonRows = (await sql`
    select id, title, prompt, blocks
    from lessons
    where id = ${lessonId}
  `) as unknown as Array<{
    id: string;
    title: string;
    prompt: string;
    blocks: unknown;
  }>;
  const lesson = lessonRows[0];
  if (!lesson) throw new Error(`sendChatMessage: lesson "${lessonId}" not found`);
  const blocks = parseOrMigrateBlocks(lesson.blocks);

  const history = await loadChatHistory(teacherId, lessonId);

  const userMsg: ChatMessage = {
    id: chatMsgId(),
    role: "user",
    content: text,
    created_at: new Date().toISOString(),
  };

  // Call the composer. We pass the existing history WITHOUT the user's
  // new message — the composer's input separates the new message from
  // the conversation so far so the model knows what it's answering.
  const result = await runTeacherLessonChat({
    lesson_title: lesson.title,
    lesson_prompt: lesson.prompt,
    lesson_blocks_flat: blocksToContextText(blocks),
    history,
    user_message: text,
  });

  const assistantMsg: ChatMessage = {
    id: chatMsgId(),
    role: "assistant",
    content: result.reply,
    suggested_action: result.suggested_action,
    action_applied: false,
    created_at: new Date().toISOString(),
  };

  const nextHistory = [...history, userMsg, assistantMsg];
  await saveChatHistory(teacherId, lessonId, nextHistory);

  return { assistant: assistantMsg, history: nextHistory };
}

// applyChatSuggestedAction — accepts a suggested_action from an
// assistant message. Creates / replaces the appropriate block, then
// marks the action as applied so the affordance can't fire again.
//
// Action kinds:
//   - insert_ai_generated: append a new ai_generated block
//   - insert_context: append a new context block (or replace if one exists)
//   - insert_prompt: replace the existing prompt block, or append one
export async function applyChatSuggestedAction(
  lessonId: string,
  messageId: string,
): Promise<void> {
  if (!lessonId || !messageId) {
    throw new Error("applyChatSuggestedAction: lessonId and messageId required");
  }
  const teacherId = "teacher_k";

  const history = await loadChatHistory(teacherId, lessonId);
  const target = history.find((m) => m.id === messageId);
  if (!target) {
    throw new Error(`applyChatSuggestedAction: message "${messageId}" not found`);
  }
  if (target.role !== "assistant" || !target.suggested_action) {
    throw new Error(
      `applyChatSuggestedAction: message "${messageId}" has no suggested_action`,
    );
  }
  if (target.action_applied) {
    // Idempotent: already applied. Return silently rather than throwing
    // so a double-click on the affordance doesn't surface as an error.
    return;
  }

  const action: ChatSuggestedAction = target.suggested_action;

  // Load and mutate the lesson's blocks per action kind.
  const lessonRows = (await sql`
    select blocks from lessons where id = ${lessonId}
  `) as unknown as Array<{ blocks: unknown }>;
  const blocks = parseOrMigrateBlocks(lessonRows[0]?.blocks);

  let nextBlocks: TypedBlock[];
  if (action.kind === "insert_ai_generated") {
    // Wrap the chat-proposed text as an AI paragraph segment. The chat
    // composer authored the prose; the audit trail names this fact
    // (model + generation timestamp set server-side). Same provenance
    // shape as ai_generated content created via the inline editor.
    const seg = {
      id: `seg_${randomUUID().slice(0, 8)}`,
      kind: "ai" as const,
      sub_kind: "paragraph" as const,
      body: action.content,
      generation: {
        prompt: "[teacher accepted from lesson-chat suggested_action]",
        model: "claude-sonnet-4-6",
        generated_at: new Date().toISOString(),
      },
    };
    nextBlocks = [
      ...blocks,
      {
        id: newId("blk"),
        type: "ai_generated",
        content: { segment: seg },
        meta: "AI-generated · teacher-accepted from chat",
      },
    ];
  } else if (action.kind === "insert_context") {
    // Context is conventionally the first block. If there's already a
    // context block, append next to it; otherwise prepend.
    const newBlock: TypedBlock = {
      id: newId("blk"),
      type: "context",
      content: action.content,
      meta: "Frame for the student · accepted from chat",
    };
    const hasContext = blocks.some((b) => b.type === "context");
    nextBlocks = hasContext ? [...blocks, newBlock] : [newBlock, ...blocks];
  } else {
    // insert_prompt — replace the existing prompt block's content if
    // there is one, otherwise append a new one.
    const promptIdx = blocks.findIndex((b) => b.type === "prompt");
    if (promptIdx >= 0) {
      nextBlocks = blocks.map((b, i) =>
        i === promptIdx && b.type === "prompt"
          ? { ...b, content: action.content }
          : b,
      );
    } else {
      nextBlocks = [
        ...blocks,
        {
          id: newId("blk"),
          type: "prompt",
          content: action.content,
          meta: "Lesson's central question · accepted from chat",
        },
      ];
    }
  }

  const promptBlock = nextBlocks.find((b) => b.type === "prompt");
  const promptText = promptBlock?.content ?? "";

  await sql`
    update lessons
    set blocks = ${sql.json(asJson(nextBlocks))},
        prompt = ${promptText}
    where id = ${lessonId}
  `;

  // Mark the chat message's action as applied.
  const updatedHistory = history.map((m) =>
    m.id === messageId ? { ...m, action_applied: true } : m,
  );
  await saveChatHistory(teacherId, lessonId, updatedHistory);

  revalidatePath(`/teacher/lessons/${lessonId}/edit`, "page");
}
