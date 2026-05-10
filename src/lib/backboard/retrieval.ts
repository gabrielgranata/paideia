/**
 * Retrieval helpers — one-shot Readonly threads. Cheap, fail-soft.
 *
 * Used to inject context into ingest / gap-surface / composer pipelines.
 * On any error: return "" and log. Backboard outage must never block the
 * user-facing request loop — Postgres is the source of truth.
 */

import { getBackboardClient } from "./client";
import { getOrCreateScope } from "./scopes";

async function retrieveOnScope(
  scope_type: "student" | "lesson",
  scope_ref_id: string,
  prompt: string,
): Promise<string> {
  try {
    const client = getBackboardClient();
    const assistant_id = await getOrCreateScope(scope_type, scope_ref_id);
    const thread = await client.createThread(assistant_id);
    const res = await client.addMessage(thread.thread_id, prompt, {
      memory: "Readonly",
      stream: false,
    });
    return res.content ?? "";
  } catch (err) {
    console.error(
      `[backboard.retrieval] ${scope_type}=${scope_ref_id} failed:`,
      err,
    );
    return "";
  }
}

/**
 * Recall what the per-student profile remembers as relevant to `query`.
 * Returns "" on any failure — caller proceeds without the extra context.
 */
export async function retrieveStudentMemory(
  student_id: string,
  query: string,
): Promise<string> {
  return retrieveOnScope(
    "student",
    student_id,
    `Recall what's relevant about: ${query}`,
  );
}

/**
 * Query the lesson's assistant. The lesson assistant has source-material
 * documents attached, so this triggers RAG over them.
 */
export async function retrieveLessonContext(
  lesson_id: string,
  query: string,
): Promise<string> {
  return retrieveOnScope(
    "lesson",
    lesson_id,
    `Recall what's relevant about: ${query}`,
  );
}
