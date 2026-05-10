/**
 * Get-or-create per-scope assistant, cached in Postgres `backboard_scopes`.
 *
 * Per-user isolation = per-assistant. Mandatory: shared assistants leak data
 * across users (cookbook recipe 12).
 *
 * Naming convention: `paideia-{scope_type}-{scope_ref_id}`.
 */

import { sql } from "@/lib/db";
import { getBackboardClient } from "./client";

export type ScopeType = "student" | "lesson" | "teacher";

const STUDENT_SYSTEM_PROMPT = `You are the persistent reasoning profile for a single Paideia student.
Your role is to recall what this student has actually worked through —
the connections they've made, the gaps they've returned to, the threads
they leave open. You never act on the student's behalf, never speak for
them, and never assert facts they haven't reasoned to. When asked to
recall, surface what you remember concretely; when nothing is relevant,
say so. Postgres is ground truth; you are an aid for deciding which
question to ask next.`;

const LESSON_SYSTEM_PROMPT = `You are the shared knowledge surface for a single Paideia lesson.
You hold the lesson's source material as indexed documents and the
cohort's emergent patterns as memories. When queried, perform RAG over
the source material and surface the most relevant passages and any
recorded cohort patterns. Do not invent. Do not summarize beyond what
the documents say. Cite or quote when possible.`;

const TEACHER_SYSTEM_PROMPT = `You are the persistent reasoning profile for a single Paideia teacher.
You hold the teacher's notes, cross-lesson observations, and patterns
they've flagged across cohorts. When queried, recall concretely what
the teacher has noted; when nothing is relevant, say so. You support
the teacher's judgment; you do not replace it.`;

function systemPromptFor(scope_type: ScopeType): string {
  switch (scope_type) {
    case "student":
      return STUDENT_SYSTEM_PROMPT;
    case "lesson":
      return LESSON_SYSTEM_PROMPT;
    case "teacher":
      return TEACHER_SYSTEM_PROMPT;
  }
}

function assistantNameFor(scope_type: ScopeType, scope_ref_id: string): string {
  return `paideia-${scope_type}-${scope_ref_id}`;
}

/**
 * Resolve the Backboard assistant_id for a scope, creating one if needed.
 *
 * Resolution order:
 *   1. backboard_scopes table (cheapest).
 *   2. listAssistants() match on name (recovers from a missing cache row,
 *      e.g. after a Postgres restore that drops the cache).
 *   3. createAssistant() with the scope-appropriate system prompt.
 *
 * The cache row is upserted on every successful resolution path.
 */
export async function getOrCreateScope(
  scope_type: ScopeType,
  scope_ref_id: string,
  opts: { name?: string } = {},
): Promise<string> {
  const cached = await sql<{ assistant_id: string }[]>`
    select assistant_id from backboard_scopes
    where scope_type = ${scope_type} and scope_ref_id = ${scope_ref_id}
    limit 1
  `;
  if (cached.length > 0) return cached[0].assistant_id;

  const client = getBackboardClient();
  const name = opts.name ?? assistantNameFor(scope_type, scope_ref_id);

  const existing = await client.listAssistants(0, 1000);
  const match = existing.find((a) => a.name === name);
  if (match) {
    await sql`
      insert into backboard_scopes (scope_type, scope_ref_id, assistant_id)
      values (${scope_type}, ${scope_ref_id}, ${match.assistant_id})
      on conflict (scope_type, scope_ref_id) do update
        set assistant_id = excluded.assistant_id
    `;
    return match.assistant_id;
  }

  const created = await client.createAssistant(name, systemPromptFor(scope_type));
  await sql`
    insert into backboard_scopes (scope_type, scope_ref_id, assistant_id)
    values (${scope_type}, ${scope_ref_id}, ${created.assistant_id})
    on conflict (scope_type, scope_ref_id) do update
      set assistant_id = excluded.assistant_id
  `;
  return created.assistant_id;
}
