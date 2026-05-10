// POST /api/teacher/generate-segment
//
// Synchronous request/response wrapper around the lesson-content-composer
// (the 6th bounded pipeline call). Server actions don't return values
// cleanly to client components — and the TipTap reading editor needs to
// receive the generated segment to insert it at the cursor — so this lives
// as a route handler instead.
//
// Pipeline:
//   1. requireRole("teacher") — auth gate.
//   2. Zod-validate the request body against ComposerInputSchema.
//   3. Call runLessonContentCompose → returns LLMEmittedAISegment.
//   4. Server-attach the audit metadata (id, generation.prompt/model/
//      generated_at). The LLM cannot forge these — they live OUTSIDE the
//      schema it emits, and we set them here.
//   5. Return the complete Segment to the client. The client inserts it
//      into the editor state and the editor's debounced save persists.
//
// Provenance discipline: every byte of generation metadata we attach here
// is auditable in Postgres after the editor saves. The teacher can later
// drill into any AI segment and see exactly which brief produced it.
//
// Importantly: this route does NOT write to Postgres. The save happens
// from the client editor through saveReadingDoc. Reason: the teacher might
// regenerate a segment 3x before keeping one — we shouldn't persist drafts
// that get thrown away. Persistence is owned by the editor.

import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth";
import {
  ComposerInputSchema,
  runLessonContentCompose,
  type ComposerInput,
} from "@/lib/llm/lesson-content-composer";
import type { Segment } from "@/lib/lesson-blocks";

const MODEL_TAG = "claude-sonnet-4-6"; // mirrors DEFAULT_MODEL in anthropic.ts

function segId(): string {
  return `seg_${randomUUID().slice(0, 8)}`;
}

function buildPromptString(input: ComposerInput): string {
  // Audit-readable record of what the teacher actually asked for. Stored
  // verbatim in segment.generation.prompt so future reviewers can see the
  // brief that produced any AI segment.
  const r = input.request;
  if (r.sub_kind === "chart" && r.teacher_data) {
    return `[${r.sub_kind}] ${r.brief}\n\n[teacher_data]\n${r.teacher_data}`;
  }
  return `[${r.sub_kind}] ${r.brief}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth — teachers only. Note that requireRole redirects on failure,
  // which doesn't make sense in a JSON API context. The redirect throws
  // a NEXT_REDIRECT error, which Next handles for page routes; for an
  // API route we'd ideally return 401. Hackathon scope accepts the
  // redirect-throw path; if this matters later we can add an inline
  // unauth check.
  await requireRole("teacher");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }

  const parsed = ComposerInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid composer input",
        issues: parsed.error.issues.slice(0, 6),
      },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Run the composer. structuredCall handles Zod retry internally; if it
  // still fails we let the ZodError propagate to a 500.
  let llmSegment;
  try {
    llmSegment = await runLessonContentCompose(input);
  } catch (err) {
    console.error("[generate-segment] composer failed:", err);
    return NextResponse.json(
      { error: "Composer call failed", detail: String(err) },
      { status: 500 },
    );
  }

  // Server-attach audit metadata. The LLM cannot set these — they live
  // outside the schema it emits.
  const generation = {
    prompt: buildPromptString(input),
    model: MODEL_TAG,
    generated_at: new Date().toISOString(),
  };
  const segment: Segment = {
    ...llmSegment,
    id: segId(),
    generation,
  } as Segment;

  return NextResponse.json({ segment });
}
