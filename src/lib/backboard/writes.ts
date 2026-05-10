/**
 * Fire-and-forget memory writes.
 *
 * Calling convention: `void writeStudentReadingMemory(...)` — never awaited
 * by the request handler. All errors are caught and logged; nothing throws
 * upward. Backboard going down must not break the request loop.
 *
 * Per cookbook: 50KB content limit; immutable memories (update = delete +
 * add); never store memory IDs in Postgres FKs.
 */

import { getBackboardClient } from "./client";
import { getOrCreateScope } from "./scopes";

const MAX_CONTENT_CHARS = 50_000;

function truncate(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text;
  return text.slice(0, MAX_CONTENT_CHARS);
}

/**
 * Send a turn to the per-student assistant with memory="Auto" so the
 * student profile accumulates over time. No thread reuse — one thread per
 * write keeps the call self-contained. The memory_operation_id is not
 * awaited; callers that genuinely need the memory available before a
 * subsequent read can use waitForMemory() in poll.ts.
 */
export async function writeStudentReadingMemory(
  student_id: string,
  lesson_title: string,
  composed_reading_text: string,
): Promise<void> {
  try {
    const client = getBackboardClient();
    const assistant_id = await getOrCreateScope("student", student_id);
    const thread = await client.createThread(assistant_id);
    const content = truncate(
      `In the lesson "${lesson_title}", this student worked through the following reasoning: ${composed_reading_text}`,
    );
    await client.addMessage(thread.thread_id, content, {
      memory: "Auto",
      stream: false,
    });
  } catch (err) {
    console.error(
      `[backboard.writes] writeStudentReadingMemory student=${student_id} failed:`,
      err,
    );
  }
}

/**
 * Explicit reading attached to the lesson assistant, tagged so cohort
 * traversal can filter client-side by metadata.type === "reading".
 */
export async function writeLessonReading(
  lesson_id: string,
  student_id: string,
  reading_content_json: unknown,
): Promise<void> {
  try {
    const client = getBackboardClient();
    const assistant_id = await getOrCreateScope("lesson", lesson_id);
    const content = truncate(
      typeof reading_content_json === "string"
        ? reading_content_json
        : JSON.stringify(reading_content_json),
    );
    await client.addMemory(assistant_id, content, {
      type: "reading",
      student_id,
      lesson_id,
      written_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      `[backboard.writes] writeLessonReading lesson=${lesson_id} student=${student_id} failed:`,
      err,
    );
  }
}

/**
 * A pattern observed across the cohort for a lesson.
 * Filter client-side by metadata.type === "cohort_pattern".
 */
export async function writeCohortPattern(
  lesson_id: string,
  pattern_text: string,
): Promise<void> {
  try {
    const client = getBackboardClient();
    const assistant_id = await getOrCreateScope("lesson", lesson_id);
    await client.addMemory(assistant_id, truncate(pattern_text), {
      type: "cohort_pattern",
      lesson_id,
      written_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      `[backboard.writes] writeCohortPattern lesson=${lesson_id} failed:`,
      err,
    );
  }
}

/**
 * A teacher-authored note. `context` is merged into metadata so the teacher
 * can structure their own filters (e.g. { type:'teacher_note',
 * lesson_id:'...', tag:'rubric' }). type is fixed to 'teacher_note'.
 */
export async function writeTeacherNote(
  teacher_id: string,
  note_text: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  try {
    const client = getBackboardClient();
    const assistant_id = await getOrCreateScope("teacher", teacher_id);
    await client.addMemory(assistant_id, truncate(note_text), {
      ...context,
      type: "teacher_note",
      teacher_id,
      written_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      `[backboard.writes] writeTeacherNote teacher=${teacher_id} failed:`,
      err,
    );
  }
}
