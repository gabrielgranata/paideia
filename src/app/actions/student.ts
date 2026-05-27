"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import {
  getOrCreateScope,
  writeStudentReadingMemory,
  retrieveStudentMemory,
} from "@/lib/backboard";
import { runProgressionCompose } from "@/lib/llm/progression-composer";
import { runArtifactCompose } from "@/lib/llm/artifact-composer";
import {
  parseCanvasLenient,
  type CanvasContent,
  type Widget,
  type AddableWidgetType,
} from "@/lib/widgets/schemas";
import { randomUUID } from "node:crypto";

// enrollInCourse — invoked from /courses. Inserts the (course, student)
// pair into course_enrollments; idempotent (the primary key is the pair).
export async function enrollInCourse(formData: FormData): Promise<void> {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const courseId = String(formData.get("course_id") ?? "").trim();
  if (!courseId) throw new Error("course_id required");

  await sql`
    insert into course_enrollments (course_id, student_id)
    values (${courseId}, ${user.student_id})
    on conflict (course_id, student_id) do nothing
  `;

  // Ensure backboard scopes exist for this student and every lesson in the
  // course they just joined. Per-lesson assistants will hold cohort patterns
  // and source-material RAG documents; per-student assistant accumulates
  // their semantic memory across sessions. Best-effort; failures don't
  // block enrollment.
  try {
    const lessonIds = (await sql`
      select id from lessons where course_id = ${courseId}
    `) as unknown as Array<{ id: string }>;

    await Promise.all([
      getOrCreateScope("student", user.student_id),
      ...lessonIds.map((l) => getOrCreateScope("lesson", l.id)),
    ]);
  } catch (err) {
    console.error("[enrollInCourse] backboard scope ensure failed:", err);
  }

  revalidatePath("/courses");
  revalidatePath("/artifacts");
  redirect("/artifacts");
}

// composeProgression — server action. Triggered from the student's
// /portfolio page ("Refresh →" on the ◆ Development sidebar). Pulls every
// per-lesson reading the student has accumulated within the course and
// runs the progression composer. Persists on `progressions` (one row per
// student × course); subsequent loads render directly from there.
//
// Best-effort backboard write: the development summary lands as a
// memory="Auto" turn on the student's per-student assistant so future
// turn_call retrievals can recall the cross-lesson arc.
export async function composeProgression(formData: FormData): Promise<void> {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const courseId = String(formData.get("course_id") ?? "").trim();
  if (!courseId) throw new Error("composeProgression: course_id required");

  const courseRows = (await sql`
    select id, title, subject, arc_seed_text from courses where id = ${courseId}
  `) as unknown as Array<{
    id: string;
    title: string;
    subject: string | null;
    arc_seed_text: string | null;
  }>;
  const course = courseRows[0];
  if (!course) throw new Error("composeProgression: course not found");

  // Every per-lesson reading the student has within this course,
  // chronological (oldest → newest). One row each.
  const readings = (await sql`
    select
      l.title as lesson_title,
      r.derived_at,
      r.derived_content
    from readings r
    join lessons l on l.id = r.lesson_id
    where r.student_id = ${user.student_id}
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
  }>;

  if (readings.length === 0) {
    throw new Error(
      "composeProgression: no readings yet — complete a session before refreshing your development view.",
    );
  }

  // Pull backboard recall over the student's profile. The composer prompt
  // is shaped to degrade gracefully when recall is empty.
  const memoryRecall = await retrieveStudentMemory(
    user.student_id,
    `What has the student been working on across "${course.title}", and how has their reasoning moved across sessions?`,
  ).catch((e) => {
    console.error("[composeProgression] retrieveStudentMemory failed:", e);
    return "";
  });

  const composed = await runProgressionCompose({
    student_name: user.name,
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

  // Course-wide row → lesson_id is null. The unique constraint uses
  // `nulls not distinct` so the conflict target matches.
  await sql`
    insert into progressions (student_id, course_id, lesson_id, derived_content, derived_at)
    values (${user.student_id}, ${courseId}, ${null}, ${sql.json(composed)}, now())
    on conflict (student_id, course_id, lesson_id) do update
      set derived_content = excluded.derived_content,
          derived_at = excluded.derived_at
  `;

  // Fire-and-forget: the progression narrative lands as a memory="Auto"
  // turn on the student's per-student assistant. Future turn_call
  // retrievals will surface "you've worked through similar gaps before."
  try {
    await writeStudentReadingMemory(
      user.student_id,
      `${course.title} — progression`,
      `Across ${readings.length} session${readings.length === 1 ? "" : "s"} — prior: ${composed.prior_state} | shift: ${composed.inflection_moment} | now: ${composed.current_state} | next: ${composed.recommended_next}`,
    );
  } catch (err) {
    console.error("[composeProgression] backboard write failed:", err);
  }

  revalidatePath("/portfolio");
  revalidatePath(`/progression/${user.student_id}`);
}

// composeArtifact — invoked from /artifacts/new. Creates an artifact row
// (status=composing), runs the artifact composer LLM call across the
// student's selected lessons, then persists the spec (status=ready) and
// redirects to the artifact view. Intent ∈ {study_guide, presentation,
// test_prep}. Lesson ids come from a multi-checkbox in the form.
//
// The composer pulls per-lesson substrate + readings + per-student
// backboard memory recall. Output spec stored in artifacts.spec_json.
// Fire-and-forget: the composed artifact also writes to the per-student
// backboard memory ("composed a study_guide on …") so the student's
// long-horizon profile knows what they've organized.
export async function composeArtifact(formData: FormData): Promise<void> {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const intentRaw = String(formData.get("intent") ?? "").trim();
  const validIntents = ["study_guide", "presentation", "test_prep"] as const;
  if (!(validIntents as readonly string[]).includes(intentRaw)) {
    throw new Error(`composeArtifact: invalid intent "${intentRaw}"`);
  }
  const intent = intentRaw as (typeof validIntents)[number];

  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("composeArtifact: title required");

  const promptText = String(formData.get("prompt") ?? "").trim() || null;
  const lessonIds = formData.getAll("lesson_id").map(String).filter(Boolean);
  if (lessonIds.length === 0) {
    throw new Error("composeArtifact: at least one lesson required");
  }

  // Insert the artifact in 'composing' state — the user can see it as
  // in-flight on /artifacts even if they navigate away while we compose.
  const artifactId = `art_${randomUUID().slice(0, 12)}`;
  const sourceScope = {
    lesson_ids: lessonIds,
    include_memory: true,
    include_documents: false,
  };
  await sql`
    insert into artifacts (id, owner_type, owner_id, type, title, prompt, source_scope, audience, spec_json, status)
    values (
      ${artifactId},
      'student',
      ${user.student_id},
      ${intent},
      ${title},
      ${promptText},
      ${sql.json(sourceScope)},
      ${sql.json({ type: "self" })},
      null,
      'composing'
    )
  `;

  // Pull per-lesson context (title + reading + substrate) for the LLM.
  type LessonRow = { lesson_id: string; lesson_title: string };
  const lessonRows = (await sql`
    select id as lesson_id, title as lesson_title
    from lessons
    where id = any(${sql.array(lessonIds)})
  `) as unknown as LessonRow[];

  type ReadingRow = {
    lesson_id: string;
    derived_content: {
      resolved?: string;
      in_progress?: string;
      unaddressed?: string;
      recommended_next?: string;
    } | null;
  };
  const readingRows = (await sql`
    select lesson_id, derived_content
    from readings
    where student_id = ${user.student_id}
      and lesson_id = any(${sql.array(lessonIds)})
  `) as unknown as ReadingRow[];

  type NodeRow = {
    lesson_id: string;
    id: string;
    role: string;
    kind: string;
    content: string;
    status: string;
  };
  const nodeRows = (await sql`
    select s.lesson_id, n.id, n.role, n.kind, n.content, n.status
    from nodes n
    join sessions s on s.id = n.session_id
    where s.student_id = ${user.student_id}
      and s.lesson_id = any(${sql.array(lessonIds)})
    order by s.lesson_id, n.created_at asc
  `) as unknown as NodeRow[];

  // Backboard recall — best-effort.
  const memoryRecall = await retrieveStudentMemory(
    user.student_id,
    `Composing a ${intent.replace("_", " ")} titled "${title}"${promptText ? ` — ${promptText}` : ""} across ${lessonIds.length} lesson${lessonIds.length === 1 ? "" : "s"}`,
  ).catch((e) => {
    console.error("[composeArtifact] retrieveStudentMemory failed:", e);
    return "";
  });

  // Build per-lesson bundles.
  const lessonsForLLM = lessonRows.map((l) => ({
    lesson_id: l.lesson_id,
    lesson_title: l.lesson_title,
    reading: readingRows.find((r) => r.lesson_id === l.lesson_id)?.derived_content
      ? {
          resolved: readingRows.find((r) => r.lesson_id === l.lesson_id)!.derived_content!.resolved ?? null,
          in_progress: readingRows.find((r) => r.lesson_id === l.lesson_id)!.derived_content!.in_progress ?? null,
          unaddressed: readingRows.find((r) => r.lesson_id === l.lesson_id)!.derived_content!.unaddressed ?? null,
          recommended_next: readingRows.find((r) => r.lesson_id === l.lesson_id)!.derived_content!.recommended_next ?? null,
        }
      : null,
    substrate_nodes: nodeRows
      .filter((n) => n.lesson_id === l.lesson_id)
      .map((n) => ({
        id: n.id,
        role: n.role,
        kind: n.kind,
        content: n.content,
        status: n.status,
      })),
  }));

  let spec;
  try {
    spec = await runArtifactCompose({
      intent,
      title,
      prompt: promptText,
      student_name: user.name,
      lessons: lessonsForLLM,
      retrieved_student_memory: memoryRecall,
    });
  } catch (err) {
    console.error("[composeArtifact] LLM call failed:", err);
    await sql`
      update artifacts set status = 'failed', updated_at = now() where id = ${artifactId}
    `;
    revalidatePath("/artifacts");
    throw err;
  }

  // Persist the spec + flip to ready. Wrap the spec in the ComposedContent
  // envelope so it matches the artifacts schema (scope + spec + generation
  // + references shape).
  const composedContent = {
    scope: sourceScope,
    spec,
    generation: {
      prompt: `artifact_compose intent=${intent}`,
      model: "claude-sonnet-4-6",
      generated_at: new Date().toISOString(),
    },
    references: [],
  };
  await sql`
    update artifacts
    set spec_json = ${sql.json(composedContent)},
        status = 'ready',
        updated_at = now()
    where id = ${artifactId}
  `;

  // Long-horizon profile update — fire-and-forget.
  try {
    const sectionTitles = spec.sections.map((s) => s.title).join(", ");
    await writeStudentReadingMemory(
      user.student_id,
      `${intent.replace("_", " ")} — ${title}`,
      `Composed a ${intent.replace("_", " ")} ("${title}") across ${lessonIds.length} lesson${lessonIds.length === 1 ? "" : "s"}. Sections: ${sectionTitles}. Open questions still being held: ${spec.meta_questions.join(" | ")}`,
    );
  } catch (err) {
    console.error("[composeArtifact] backboard write failed:", err);
  }

  revalidatePath("/artifacts");
  redirect(`/artifacts/${artifactId}`);
}

// unenrollFromCourse — symmetric. Not used in the current UI but cheap to
// keep so /courses can offer it.
export async function unenrollFromCourse(formData: FormData): Promise<void> {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const courseId = String(formData.get("course_id") ?? "").trim();
  if (!courseId) throw new Error("course_id required");

  await sql`
    delete from course_enrollments
    where course_id = ${courseId} and student_id = ${user.student_id}
  `;

  revalidatePath("/courses");
  revalidatePath("/artifacts");
}

// ── canvas / note widgets ────────────────────────────────────────────
//
// Notes are Notion-style canvases — a stacked list of typed widgets the
// student composes. Server actions follow the form-action pattern.
// Patches the entire widgets array on each operation (read-modify-write
// of spec_json). At v0 scale this is cheaper than positional patching.

function newWidgetId(): string {
  return `w_${randomUUID().slice(0, 10)}`;
}

async function readNoteCanvas(
  artifactId: string,
  studentId: string,
): Promise<{ widgets: Widget[]; spec: CanvasContent & { tags?: string[] } }> {
  const rows = (await sql`
    select spec_json from artifacts
    where id = ${artifactId}
      and owner_type = 'student'
      and owner_id = ${studentId}
      and type = 'note'
  `) as unknown as Array<{ spec_json: unknown }>;
  if (rows.length === 0) throw new Error("Note not found or not yours");
  const canvas = parseCanvasLenient(rows[0].spec_json);
  const tags = (rows[0].spec_json as { tags?: string[] } | null)?.tags;
  return { widgets: canvas.widgets, spec: { widgets: canvas.widgets, tags } };
}

async function writeNoteCanvas(
  artifactId: string,
  next: CanvasContent & { tags?: string[] },
): Promise<void> {
  await sql`
    update artifacts
    set spec_json = ${sql.json(next)}, status = 'ready', updated_at = now()
    where id = ${artifactId}
  `;
  revalidatePath(`/artifacts/${artifactId}`);
  revalidatePath("/artifacts");
}

// createNote — invoked from "+ New note" CTA. One initial empty text
// widget so the student lands on a writeable surface, not a blank page.
export async function createNote(): Promise<void> {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const id = `art_${randomUUID().slice(0, 12)}`;
  const initial: CanvasContent = {
    widgets: [
      { id: newWidgetId(), type: "text", authored_by: "student", body: "" },
    ],
  };
  await sql`
    insert into artifacts (id, owner_type, owner_id, type, title, prompt, source_scope, audience, spec_json, status)
    values (
      ${id}, 'student', ${user.student_id}, 'note',
      ${"Untitled note"}, null,
      ${sql.json({ lesson_ids: [], include_memory: false, include_documents: false })},
      ${sql.json({ type: "self" })},
      ${sql.json(initial)},
      'ready'
    )
  `;
  revalidatePath("/artifacts");
  redirect(`/artifacts/${id}`);
}

export async function renameNote(formData: FormData): Promise<void> {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");
  const artifactId = String(formData.get("artifact_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || "Untitled note";
  if (!artifactId) throw new Error("artifact_id required");
  await sql`
    update artifacts
    set title = ${title}, updated_at = now()
    where id = ${artifactId}
      and owner_type = 'student'
      and owner_id = ${user.student_id}
      and type = 'note'
  `;
  revalidatePath(`/artifacts/${artifactId}`);
}

export async function addWidget(formData: FormData): Promise<void> {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const artifactId = String(formData.get("artifact_id") ?? "").trim();
  const typeRaw = String(formData.get("widget_type") ?? "").trim();
  const afterId = String(formData.get("after_widget_id") ?? "").trim() || null;
  if (!artifactId) throw new Error("artifact_id required");

  const ADDABLE: ReadonlyArray<AddableWidgetType> = [
    "text",
    "quote",
    "source_ref",
    "divider",
  ];
  if (!(ADDABLE as readonly string[]).includes(typeRaw)) {
    throw new Error(`addWidget: type "${typeRaw}" not student-addable`);
  }
  const widgetType = typeRaw as AddableWidgetType;

  const { widgets, spec } = await readNoteCanvas(artifactId, user.student_id);

  let newWidget: Widget;
  switch (widgetType) {
    case "text":
      newWidget = { id: newWidgetId(), type: "text", authored_by: "student", body: "" };
      break;
    case "quote":
      newWidget = { id: newWidgetId(), type: "quote", authored_by: "student", body: "" };
      break;
    case "source_ref":
      newWidget = {
        id: newWidgetId(),
        type: "source_ref",
        authored_by: "student",
        ref: {
          ref_type: "external_url",
          ref_id: "tbd",
          origin: "student_cited",
          label: "Untitled source",
        },
      };
      break;
    case "divider":
      newWidget = { id: newWidgetId(), type: "divider", authored_by: "student" };
      break;
  }

  let next: Widget[];
  if (afterId) {
    const idx = widgets.findIndex((w) => w.id === afterId);
    if (idx === -1) next = [...widgets, newWidget];
    else next = [...widgets.slice(0, idx + 1), newWidget, ...widgets.slice(idx + 1)];
  } else {
    next = [...widgets, newWidget];
  }

  await writeNoteCanvas(artifactId, { ...spec, widgets: next });
}

export async function updateWidget(formData: FormData): Promise<void> {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const artifactId = String(formData.get("artifact_id") ?? "").trim();
  const widgetId = String(formData.get("widget_id") ?? "").trim();
  if (!artifactId || !widgetId) throw new Error("artifact_id + widget_id required");

  const { widgets, spec } = await readNoteCanvas(artifactId, user.student_id);
  const idx = widgets.findIndex((w) => w.id === widgetId);
  if (idx === -1) throw new Error(`updateWidget: widget ${widgetId} not found`);

  const w = widgets[idx];
  let next: Widget;
  switch (w.type) {
    case "text":
      next = { ...w, body: String(formData.get("body") ?? "") };
      break;
    case "quote":
      next = {
        ...w,
        body: String(formData.get("body") ?? ""),
        source: String(formData.get("source") ?? "").trim() || undefined,
      };
      break;
    case "source_ref":
      next = {
        ...w,
        ref: {
          ...w.ref,
          label: String(formData.get("label") ?? "").trim() || w.ref.label,
        },
        note: String(formData.get("note") ?? "").trim() || undefined,
      };
      break;
    case "divider":
      next = w;
      break;
    case "ai_observation":
      throw new Error("ai_observation widgets cannot be student-edited");
  }

  const nextWidgets = [...widgets];
  nextWidgets[idx] = next;
  await writeNoteCanvas(artifactId, { ...spec, widgets: nextWidgets });
}

export async function removeWidget(formData: FormData): Promise<void> {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  const artifactId = String(formData.get("artifact_id") ?? "").trim();
  const widgetId = String(formData.get("widget_id") ?? "").trim();
  if (!artifactId || !widgetId) throw new Error("artifact_id + widget_id required");

  const { widgets, spec } = await readNoteCanvas(artifactId, user.student_id);
  const next = widgets.filter((w) => w.id !== widgetId);
  if (next.length === 0) {
    next.push({ id: newWidgetId(), type: "text", authored_by: "student", body: "" });
  }
  await writeNoteCanvas(artifactId, { ...spec, widgets: next });
}
