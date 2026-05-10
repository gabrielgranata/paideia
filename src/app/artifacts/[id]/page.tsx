import { notFound } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";
import { ARTIFACT_LABEL, type ArtifactType } from "@/lib/artifacts";
import { parseCanvasLenient, type Widget } from "@/lib/widgets/schemas";
import {
  addWidget,
  removeWidget,
  renameNote,
  updateWidget,
} from "@/app/actions/student";

// /artifacts/[id] — render an artifact.
//
// Dispatches by artifact.type:
//   - composed family (study_guide / presentation / test_prep) → the
//     existing per-section renderer
//   - note → Notion-style widget canvas (text / quote / source_ref /
//     divider, plus AI ◆ widgets the system can drop in)
//   - other writing / structured types → not yet rendered (placeholder)

type ArtifactRow = {
  id: string;
  owner_type: "student" | "teacher";
  owner_id: string;
  type: ArtifactType;
  title: string;
  prompt: string | null;
  source_scope: { lesson_ids: string[]; include_memory: boolean } | null;
  spec_json: ComposedContent | null;
  status: "pending" | "composing" | "ready" | "failed";
  created_at: Date;
  updated_at: Date;
};

type ComposedContent = {
  scope: { lesson_ids: string[]; include_memory: boolean };
  spec: ArtifactSpec;
  generation: { prompt: string; model: string; generated_at: string };
  references?: ArtifactRef[];
};

type ArtifactSpec = {
  intent: "study_guide" | "presentation" | "test_prep";
  sections: ArtifactSection[];
  meta_questions: string[];
};

type ArtifactSection = {
  title: string;
  body: string;
  citations: ArtifactRef[];
  open_questions: string[];
};

type ArtifactRef = {
  ref_type: string;
  ref_id: string;
  origin?: string;
  label?: string;
};

export default async function ArtifactViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");
  const { id } = await params;

  const rows = (await sql`
    select id, owner_type, owner_id, type, title, prompt, source_scope, spec_json, status, created_at, updated_at
    from artifacts
    where id = ${id}
  `) as unknown as ArtifactRow[];
  const artifact = rows[0];
  if (!artifact) notFound();

  // Defense in depth — student can only view their own artifacts.
  if (artifact.owner_type !== "student" || artifact.owner_id !== user.student_id) {
    notFound();
  }

  // Note artifact dispatch — Notion-style canvas. Render and return early;
  // the composed-artifact rendering below doesn't apply.
  if (artifact.type === "note") {
    const canvas = parseCanvasLenient(artifact.spec_json);
    return (
      <NoteCanvasPage
        artifactId={artifact.id}
        title={artifact.title}
        widgets={canvas.widgets}
        userName={user.name}
        userEmail={user.email}
        userRole={user.role}
      />
    );
  }

  const isComposing = artifact.status === "composing";
  const isFailed = artifact.status === "failed";
  const isReady = artifact.status === "ready" && artifact.spec_json !== null;

  // Resolve lesson titles for the scope display.
  type LessonTitleRow = { id: string; title: string };
  const lessonIds = artifact.source_scope?.lesson_ids ?? [];
  const lessonTitleRows = lessonIds.length > 0
    ? ((await sql`
        select id, title from lessons where id = any(${sql.array(lessonIds)})
      `) as unknown as LessonTitleRow[])
    : [];
  const lessonTitleById = new Map(lessonTitleRows.map((l) => [l.id, l.title]));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: tokens.color.canvas,
      }}
    >
      <Chrome
        title={artifact.title}
        subtitle={`${ARTIFACT_LABEL[artifact.type]} · ${user.name}`}
        backHref="/artifacts"
        backLabel="Your work"
        user={user}
      />

      <div
        style={{
          flex: 1,
          maxWidth: 880,
          margin: "0 auto",
          width: "100%",
          padding: "32px 36px 64px",
        }}
      >
        {/* Header — meta */}
        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 9,
              fontWeight: 700,
              color: tokens.color.faint,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {ARTIFACT_LABEL[artifact.type]}
            {lessonTitleRows.length > 0 && (
              <>
                {" · drawn from "}
                {lessonTitleRows.map((l) => l.title).join(" · ")}
              </>
            )}
          </div>
          <h1
            style={{
              fontFamily: tokens.font.body,
              fontSize: 28,
              fontStyle: "italic",
              fontWeight: 500,
              color: tokens.color.text,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {artifact.title}
          </h1>
          {artifact.prompt && (
            <p
              style={{
                fontFamily: tokens.font.body,
                fontSize: 13,
                color: tokens.color.sec,
                fontStyle: "italic",
                lineHeight: 1.6,
                margin: "12px 0 0",
                paddingLeft: 12,
                borderLeft: `1.5px solid ${tokens.color.border}`,
              }}
            >
              {artifact.prompt}
            </p>
          )}
        </header>

        {/* AI authorship label — non-negotiable per design. The artifact
            was composed by the system from the student's reasoning;
            label it. */}
        <div
          style={{
            background: tokens.ai.bg,
            border: `1px solid ${tokens.ai.border}`,
            borderRadius: 4,
            padding: "10px 14px",
            marginBottom: 24,
            display: "flex",
            alignItems: "baseline",
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 9,
              fontWeight: 700,
              color: tokens.ai.label,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
            }}
          >
            {tokens.aiMarker} Composed by the system
          </span>
          <span
            style={{
              fontFamily: tokens.font.body,
              fontSize: 12,
              color: tokens.ai.text,
              fontStyle: "italic",
              flex: 1,
            }}
          >
            organized from your reasoning · open questions stay open · no new claims added
          </span>
        </div>

        {isComposing && <ComposingState />}
        {isFailed && <FailedState artifactId={artifact.id} />}
        {isReady && (
          <ArtifactSpecRender
            spec={artifact.spec_json!.spec}
            lessonTitleById={lessonTitleById}
          />
        )}
      </div>
    </div>
  );
}

function ComposingState() {
  return (
    <div
      style={{
        padding: "40px 32px",
        background: tokens.color.cardLight,
        border: `1px dashed ${tokens.color.border}`,
        borderRadius: 4,
        textAlign: "center",
        fontFamily: tokens.font.body,
        fontSize: 14,
        fontStyle: "italic",
        color: tokens.color.sec,
        lineHeight: 1.7,
      }}
    >
      Composing… The system is reading what you&apos;ve worked through and
      organizing it. This usually takes 6–10 seconds. Refresh the page if
      it&apos;s been longer.
    </div>
  );
}

function FailedState({ artifactId: _artifactId }: { artifactId: string }) {
  return (
    <div
      style={{
        padding: "20px 24px",
        background: tokens.color.flagBg,
        border: `1px solid ${tokens.color.flagBd}`,
        borderRadius: 4,
        fontFamily: tokens.font.body,
        fontSize: 13,
        color: tokens.color.flagText,
        fontStyle: "italic",
        lineHeight: 1.6,
      }}
    >
      Composition failed. The substrate write succeeded — your work is
      safe — but the artifact spec didn&apos;t get produced.{" "}
      <Link
        href="/artifacts/new"
        style={{ color: tokens.color.flagLabel, textDecoration: "underline" }}
      >
        Try again
      </Link>
      .
    </div>
  );
}

function ArtifactSpecRender({
  spec,
  lessonTitleById,
}: {
  spec: ArtifactSpec;
  lessonTitleById: Map<string, string>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {spec.sections.map((section, i) => (
        <SectionCard
          key={i}
          section={section}
          lessonTitleById={lessonTitleById}
          intent={spec.intent}
          index={i}
        />
      ))}

      {spec.meta_questions.length > 0 && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 24,
            borderTop: `1px solid ${tokens.color.border}`,
          }}
        >
          <div
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 9,
              fontWeight: 700,
              color: tokens.ai.label,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            {tokens.aiMarker} Questions you&apos;re still holding
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {spec.meta_questions.map((q, i) => (
              <li
                key={i}
                style={{
                  paddingLeft: 14,
                  borderLeft: `1.5px solid ${tokens.color.border}`,
                  fontFamily: tokens.font.body,
                  fontSize: 14,
                  fontStyle: "italic",
                  lineHeight: 1.7,
                  color: tokens.color.sec,
                }}
              >
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SectionCard({
  section,
  lessonTitleById,
  intent,
  index,
}: {
  section: ArtifactSection;
  lessonTitleById: Map<string, string>;
  intent: ArtifactSpec["intent"];
  index: number;
}) {
  const eyebrow =
    intent === "presentation"
      ? `Slide ${String(index + 1).padStart(2, "0")}`
      : intent === "test_prep"
        ? `Topic ${String(index + 1).padStart(2, "0")}`
        : `Section ${String(index + 1).padStart(2, "0")}`;
  return (
    <article
      style={{
        background: tokens.color.cardLight,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 5,
        padding: "20px 24px",
        boxShadow: tokens.shadow,
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.faint,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          fontFamily: tokens.font.body,
          fontSize: 19,
          fontStyle: "italic",
          fontWeight: 500,
          color: tokens.color.text,
          margin: "0 0 12px",
          lineHeight: 1.35,
        }}
      >
        {section.title}
      </h2>
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 14,
          lineHeight: 1.78,
          color: tokens.color.text,
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {section.body}
      </p>

      {section.citations.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {section.citations.map((c, i) => (
            <CitationChip key={i} citation={c} lessonTitleById={lessonTitleById} />
          ))}
        </div>
      )}

      {section.open_questions.length > 0 && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${tokens.color.border}`,
          }}
        >
          <div
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 8,
              fontWeight: 700,
              color: tokens.color.faint,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {tokens.aiMarker} Still open here
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 4px", listStyle: "none" }}>
            {section.open_questions.map((q, i) => (
              <li
                key={i}
                style={{
                  fontFamily: tokens.font.body,
                  fontSize: 13,
                  fontStyle: "italic",
                  lineHeight: 1.65,
                  color: tokens.color.sec,
                  marginBottom: 4,
                }}
              >
                · {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function CitationChip({
  citation,
  lessonTitleById,
}: {
  citation: ArtifactRef;
  lessonTitleById: Map<string, string>;
}) {
  // Resolve a friendly label. Lesson-block refs go through the lesson
  // title map; nodes/turns/memory show their type + id-suffix as a
  // fallback. This is the design's `↗` chip pattern.
  const label =
    citation.label ??
    (citation.ref_type === "lesson_block" && lessonTitleById.has(citation.ref_id)
      ? lessonTitleById.get(citation.ref_id)!
      : `${citation.ref_type} · ${citation.ref_id.slice(0, 10)}`);
  return (
    <span
      title={`${citation.ref_type} · ${citation.ref_id}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 9px",
        fontFamily: tokens.font.body,
        fontSize: 11,
        fontStyle: "italic",
        color: tokens.ai.text,
        background: tokens.ai.faint,
        border: `1px solid ${tokens.ai.border}`,
        borderRadius: 2,
      }}
    >
      ↗ {label}
    </span>
  );
}

// ── Note canvas ──────────────────────────────────────────────────────
//
// Notion-style stacked widgets. Each widget renders inline with a small
// edit form (textarea + Save) and a × Remove. The "+ widget" picker at
// the bottom lets the student append text / quote / source / divider.
//
// Authorship discipline:
//   - Student widgets render with no marker. The page is theirs.
//   - AI ◆ widgets (ai_observation) render in margin tone with the ◆
//     prefix and are not editable from this surface.

function NoteCanvasPage({
  artifactId,
  title,
  widgets,
  userName,
  userEmail,
  userRole,
}: {
  artifactId: string;
  title: string;
  widgets: Widget[];
  userName: string;
  userEmail: string;
  userRole: "student" | "teacher";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: tokens.color.canvas,
      }}
    >
      <Chrome
        title={title || "Untitled note"}
        subtitle="Note"
        backHref="/artifacts"
        backLabel="Your work"
        user={{ name: userName, email: userEmail, role: userRole }}
      />

      <div
        style={{
          flex: 1,
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
          padding: "32px 36px 64px",
        }}
      >
        {/* Title — inline editable */}
        <form action={renameNote} style={{ marginBottom: 28 }}>
          <input type="hidden" name="artifact_id" value={artifactId} />
          <input
            name="title"
            type="text"
            defaultValue={title}
            placeholder="Untitled note"
            onBlur={undefined /* server-action submits on blur via JS-less submit; users can also press Enter */}
            style={{
              width: "100%",
              fontFamily: tokens.font.body,
              fontSize: 28,
              fontStyle: "italic",
              fontWeight: 500,
              color: tokens.color.text,
              background: "transparent",
              border: "none",
              outline: "none",
              padding: 0,
            }}
          />
          {/* Visually quiet save — the server action saves on form submit
              (Enter key); a button is here for keyboard-less users. */}
          <button type="submit" style={{ display: "none" }} aria-hidden>
            Save
          </button>
        </form>

        {/* Widgets — render in order */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {widgets.map((w) => (
            <WidgetRow key={w.id} widget={w} artifactId={artifactId} />
          ))}
        </div>

        {/* Add-widget picker */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingTop: 16,
            borderTop: `1px solid ${tokens.color.border}`,
          }}
        >
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 9,
              fontWeight: 700,
              color: tokens.color.faint,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              marginRight: 8,
            }}
          >
            Add
          </span>
          {[
            { type: "text", label: "Text" },
            { type: "quote", label: "Quote" },
            { type: "source_ref", label: "Source" },
            { type: "divider", label: "Divider" },
          ].map((it) => (
            <form
              key={it.type}
              action={addWidget}
              style={{ display: "inline" }}
            >
              <input type="hidden" name="artifact_id" value={artifactId} />
              <input type="hidden" name="widget_type" value={it.type} />
              <button
                type="submit"
                style={{
                  background: "transparent",
                  border: `1px dashed ${tokens.color.border}`,
                  borderRadius: 3,
                  padding: "5px 12px",
                  fontFamily: tokens.font.ui,
                  fontSize: 10,
                  fontWeight: 600,
                  color: tokens.color.ter,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                + {it.label}
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}

function WidgetRow({
  widget,
  artifactId,
}: {
  widget: Widget;
  artifactId: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 8,
        position: "relative",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {widget.type === "text" && (
          <TextWidgetEditor widget={widget} artifactId={artifactId} />
        )}
        {widget.type === "quote" && (
          <QuoteWidgetEditor widget={widget} artifactId={artifactId} />
        )}
        {widget.type === "source_ref" && (
          <SourceRefWidgetEditor widget={widget} artifactId={artifactId} />
        )}
        {widget.type === "divider" && <DividerWidget />}
        {widget.type === "ai_observation" && (
          <AIObservationWidget widget={widget} />
        )}
      </div>
      {/* AI widgets aren't student-removable; everything else is. */}
      {widget.type !== "ai_observation" && (
        <RemoveWidgetButton artifactId={artifactId} widgetId={widget.id} />
      )}
    </div>
  );
}

function TextWidgetEditor({
  widget,
  artifactId,
}: {
  widget: Extract<Widget, { type: "text" }>;
  artifactId: string;
}) {
  return (
    <form action={updateWidget}>
      <input type="hidden" name="artifact_id" value={artifactId} />
      <input type="hidden" name="widget_id" value={widget.id} />
      <textarea
        name="body"
        defaultValue={widget.body}
        rows={Math.max(3, Math.ceil((widget.body.length || 80) / 80))}
        placeholder="Type a paragraph…"
        style={{
          width: "100%",
          fontFamily: tokens.font.body,
          fontSize: 16,
          lineHeight: 1.85,
          color: tokens.color.text,
          background: "transparent",
          border: "none",
          outline: "none",
          padding: "2px 0",
          resize: "vertical",
        }}
      />
      <SaveAffordance />
    </form>
  );
}

function QuoteWidgetEditor({
  widget,
  artifactId,
}: {
  widget: Extract<Widget, { type: "quote" }>;
  artifactId: string;
}) {
  return (
    <form
      action={updateWidget}
      style={{
        paddingLeft: 14,
        borderLeft: `2.5px solid ${tokens.color.border}`,
      }}
    >
      <input type="hidden" name="artifact_id" value={artifactId} />
      <input type="hidden" name="widget_id" value={widget.id} />
      <textarea
        name="body"
        defaultValue={widget.body}
        rows={Math.max(2, Math.ceil((widget.body.length || 60) / 70))}
        placeholder='"Quote the passage…"'
        style={{
          width: "100%",
          fontFamily: tokens.font.body,
          fontSize: 15,
          fontStyle: "italic",
          lineHeight: 1.75,
          color: tokens.color.sec,
          background: "transparent",
          border: "none",
          outline: "none",
          padding: "2px 0",
          resize: "vertical",
        }}
      />
      <input
        name="source"
        defaultValue={widget.source ?? ""}
        placeholder="— attribution (optional)"
        style={{
          width: "100%",
          fontFamily: tokens.font.body,
          fontSize: 12,
          color: tokens.color.ter,
          background: "transparent",
          border: "none",
          outline: "none",
          padding: "4px 0 0",
        }}
      />
      <SaveAffordance />
    </form>
  );
}

function SourceRefWidgetEditor({
  widget,
  artifactId,
}: {
  widget: Extract<Widget, { type: "source_ref" }>;
  artifactId: string;
}) {
  return (
    <form
      action={updateWidget}
      style={{
        background: tokens.ai.faint,
        border: `1px solid ${tokens.ai.border}`,
        borderRadius: 3,
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <input type="hidden" name="artifact_id" value={artifactId} />
      <input type="hidden" name="widget_id" value={widget.id} />
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            fontFamily: tokens.font.body,
            fontSize: 13,
            color: tokens.ai.text,
          }}
        >
          ↗
        </span>
        <input
          name="label"
          defaultValue={widget.ref.label ?? ""}
          placeholder="Source title or quick reference"
          style={{
            flex: 1,
            fontFamily: tokens.font.body,
            fontStyle: "italic",
            fontSize: 13,
            color: tokens.ai.text,
            background: "transparent",
            border: "none",
            outline: "none",
            padding: 0,
          }}
        />
      </div>
      <input
        name="note"
        defaultValue={widget.note ?? ""}
        placeholder="Why this source matters here (optional)"
        style={{
          width: "100%",
          fontFamily: tokens.font.body,
          fontSize: 11,
          color: tokens.color.sec,
          background: "transparent",
          border: "none",
          outline: "none",
          padding: 0,
        }}
      />
      <SaveAffordance />
    </form>
  );
}

function DividerWidget() {
  return (
    <hr
      style={{
        border: "none",
        borderTop: `1px solid ${tokens.color.border}`,
        margin: "10px 0",
      }}
    />
  );
}

function AIObservationWidget({
  widget,
}: {
  widget: Extract<Widget, { type: "ai_observation" }>;
}) {
  return (
    <div
      style={{
        background: tokens.ai.bg,
        border: `1px solid ${tokens.ai.border}`,
        borderLeft: `2.5px solid ${tokens.ai.border}`,
        borderRadius: "0 4px 4px 0",
        padding: "10px 14px",
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 8,
          fontWeight: 700,
          color: tokens.ai.label,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {tokens.aiMarker} Observation
      </div>
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          fontStyle: "italic",
          lineHeight: 1.65,
          color: tokens.ai.text,
          margin: 0,
        }}
      >
        {widget.body}
      </p>
    </div>
  );
}

function RemoveWidgetButton({
  artifactId,
  widgetId,
}: {
  artifactId: string;
  widgetId: string;
}) {
  return (
    <form action={removeWidget} style={{ display: "inline" }}>
      <input type="hidden" name="artifact_id" value={artifactId} />
      <input type="hidden" name="widget_id" value={widgetId} />
      <button
        type="submit"
        title="Remove this widget"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: tokens.font.ui,
          fontSize: 11,
          color: tokens.color.faint,
          padding: "4px 6px",
          alignSelf: "flex-start",
        }}
      >
        ×
      </button>
    </form>
  );
}

function SaveAffordance() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
      <button
        type="submit"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: tokens.font.ui,
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.faint,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          padding: 0,
        }}
      >
        Save
      </button>
    </div>
  );
}
