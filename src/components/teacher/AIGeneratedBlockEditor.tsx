"use client";

// AIGeneratedBlockEditor — inline editor for one `ai_generated` block.
//
// States:
//   - Empty (segment === null): renders a slim inline generate panel
//     (sub-kind toggle: paragraph / chart / diagram + brief textarea +
//     generate button). On success, the segment lands here.
//   - Paragraph: editable body textarea (the teacher can refine the AI's
//     prose) + ◆ provenance stripe + clear/regenerate footer. Body edits
//     debounce-save through saveAIGeneratedSegment; the generation stamp
//     is preserved verbatim.
//   - Chart / diagram: render via the shared AIChartFigure /
//     AIDiagramFigure components + a footer with clear/regenerate.
//
// Generation flow goes through /api/teacher/generate-segment — same route
// the reading editor uses for its inline segments. The route attaches
// server-side audit metadata; we just persist the result.
//
// Discipline:
//   - Provenance cannot be forged from the client. The generation stamp
//     comes back from the route handler; this component only persists
//     what it receives.
//   - There's no "convert this AI segment to a human one" command. The
//     ai_generated block is by definition AI-authored; if the teacher
//     wants human prose, the reading block is the right primitive.

import { useEffect, useRef, useState, useTransition } from "react";
import { saveAIGeneratedSegment } from "@/app/actions/teacher";
import { tokens } from "@/lib/design/tokens";
import { AIChartFigure } from "./segment-renderers/AIChartFigure";
import { AIDiagramFigure } from "./segment-renderers/AIDiagramFigure";
import type {
  AISegment,
  AIParagraphSegment,
  AIChartSegment,
  AIDiagramSegment,
  Segment,
} from "@/lib/lesson-blocks";

type SubKind = "paragraph" | "chart" | "diagram";

const BODY_SAVE_DEBOUNCE_MS = 600;

type Props = {
  lessonId: string;
  blockId: string;
  lessonTitle: string;
  lessonPrompt: string;
  initialSegment: AISegment | null;
};

export function AIGeneratedBlockEditor({
  lessonId,
  blockId,
  lessonTitle,
  lessonPrompt,
  initialSegment,
}: Props) {
  const [segment, setSegment] = useState<AISegment | null>(initialSegment);
  const [showGenerate, setShowGenerate] = useState<boolean>(
    initialSegment === null,
  );

  // Sync if the parent passes a new initial segment (e.g. after a server
  // revalidate).
  useEffect(() => {
    setSegment(initialSegment);
    setShowGenerate(initialSegment === null);
  }, [initialSegment]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {segment === null ? (
        <EmptyState
          lessonId={lessonId}
          blockId={blockId}
          lessonTitle={lessonTitle}
          lessonPrompt={lessonPrompt}
          onGenerated={(s) => {
            setSegment(s);
            setShowGenerate(false);
          }}
        />
      ) : (
        <FilledState
          lessonId={lessonId}
          blockId={blockId}
          lessonTitle={lessonTitle}
          lessonPrompt={lessonPrompt}
          segment={segment}
          showGenerate={showGenerate}
          onSegmentChanged={setSegment}
          onToggleGenerate={() => setShowGenerate((v) => !v)}
        />
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────

function EmptyState({
  lessonId,
  blockId,
  lessonTitle,
  lessonPrompt,
  onGenerated,
}: {
  lessonId: string;
  blockId: string;
  lessonTitle: string;
  lessonPrompt: string;
  onGenerated: (s: AISegment) => void;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        border: `1px dashed ${tokens.color.border}`,
        borderRadius: 3,
        background: tokens.color.cardLight,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: tokens.color.ter,
            background: tokens.color.margin,
            border: `1px solid ${tokens.color.border}`,
            padding: "2px 9px",
            fontFamily: tokens.font.ui,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            borderRadius: 10,
          }}
        >
          ◆ AI Generated · empty
        </span>
        <span
          style={{
            fontSize: 10,
            color: tokens.color.ter,
            fontFamily: tokens.font.body,
            fontStyle: "italic",
            marginLeft: "auto",
          }}
        >
          Generate a paragraph, chart, or diagram for the student to read.
        </span>
      </header>
      <GeneratePanel
        lessonId={lessonId}
        blockId={blockId}
        lessonTitle={lessonTitle}
        lessonPrompt={lessonPrompt}
        onGenerated={onGenerated}
        onCancel={null}
      />
    </div>
  );
}

// ── Filled state — paragraph / chart / diagram ────────────────────────

function FilledState({
  lessonId,
  blockId,
  lessonTitle,
  lessonPrompt,
  segment,
  showGenerate,
  onSegmentChanged,
  onToggleGenerate,
}: {
  lessonId: string;
  blockId: string;
  lessonTitle: string;
  lessonPrompt: string;
  segment: AISegment;
  showGenerate: boolean;
  onSegmentChanged: (s: AISegment | null) => void;
  onToggleGenerate: () => void;
}) {
  const [, startTransition] = useTransition();

  function clear(): void {
    if (!window.confirm("Clear this AI segment? Provenance will be lost.")) return;
    onSegmentChanged(null);
    startTransition(async () => {
      try {
        await saveAIGeneratedSegment(lessonId, blockId, null);
      } catch (err) {
        console.error("[AIGeneratedBlockEditor] clear failed:", err);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {segment.sub_kind === "paragraph" && (
        <AIParagraphEditor
          lessonId={lessonId}
          blockId={blockId}
          segment={segment}
          onChange={(next) => onSegmentChanged(next)}
        />
      )}
      {segment.sub_kind === "chart" && (
        <AIChartFigure segment={segment} />
      )}
      {segment.sub_kind === "diagram" && (
        <AIDiagramFigure segment={segment} />
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          fontFamily: tokens.font.ui,
          fontSize: 9,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <button
          type="button"
          onClick={onToggleGenerate}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.color.ter,
            padding: 0,
            textDecoration: "underline",
            textUnderlineOffset: 3,
            fontFamily: tokens.font.ui,
          }}
        >
          {showGenerate ? "↶ Cancel regenerate" : "↻ Regenerate"}
        </button>
        <button
          type="button"
          onClick={clear}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.color.faint,
            padding: 0,
            textDecoration: "underline",
            textUnderlineOffset: 3,
            fontFamily: tokens.font.ui,
          }}
        >
          ✕ Clear segment
        </button>
      </div>

      {showGenerate && (
        <div
          style={{
            padding: "10px 12px",
            border: `1px dashed ${tokens.color.border}`,
            background: tokens.color.cardLight,
            borderRadius: 3,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: tokens.color.ter,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: tokens.font.ui,
              marginBottom: 8,
            }}
          >
            Replace this segment
          </div>
          <GeneratePanel
            lessonId={lessonId}
            blockId={blockId}
            lessonTitle={lessonTitle}
            lessonPrompt={lessonPrompt}
            onGenerated={(s) => onSegmentChanged(s)}
            onCancel={onToggleGenerate}
          />
        </div>
      )}
    </div>
  );
}

// ── AI paragraph — editable body + provenance ─────────────────────────

function AIParagraphEditor({
  lessonId,
  blockId,
  segment,
  onChange,
}: {
  lessonId: string;
  blockId: string;
  segment: AIParagraphSegment;
  onChange: (next: AIParagraphSegment) => void;
}) {
  const [body, setBody] = useState(segment.body);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setBody(segment.body), [segment.id, segment.body]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const generatedAt = new Date(segment.generation.generated_at).toLocaleString(
    "en-US",
    { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  );

  function onBodyChange(value: string): void {
    setBody(value);
    setStatus("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        // Empty body would fail Zod (paragraph.body.min(1)). Keep local
        // state but don't persist; the teacher can clear segment via the
        // explicit "Clear" affordance instead.
        return;
      }
      const next: AIParagraphSegment = { ...segment, body: trimmed };
      setStatus("saving");
      startTransition(async () => {
        try {
          await saveAIGeneratedSegment(lessonId, blockId, next);
          onChange(next);
          setStatus("saved");
        } catch (err) {
          console.error("[AIParagraphEditor] save failed:", err);
          setStatus("error");
        }
      });
    }, BODY_SAVE_DEBOUNCE_MS);
  }

  return (
    <div
      style={{
        padding: "10px 14px",
        borderLeft: `2px solid ${tokens.color.border}`,
        background: tokens.color.margin,
        borderRadius: "0 3px 3px 0",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: tokens.color.ter,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontFamily: tokens.font.ui,
          }}
        >
          {tokens.aiMarker} AI paragraph
        </span>
        <span
          style={{
            fontSize: 8,
            color: tokens.color.faint,
            letterSpacing: "0.06em",
            fontFamily: tokens.font.ui,
          }}
        >
          · {generatedAt}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: tokens.font.ui,
            fontSize: 8,
            color: tokens.color.faint,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
          {status === "error" && "Save failed"}
        </span>
      </header>
      <textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        rows={Math.max(2, Math.ceil(body.length / 80))}
        style={{
          width: "100%",
          padding: "4px 0",
          fontSize: 13,
          lineHeight: 1.65,
          color: tokens.color.sec,
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily: tokens.font.body,
          fontStyle: "italic",
          resize: "vertical",
        }}
      />
    </div>
  );
}

// ── Generate panel (paragraph / chart / diagram) ─────────────────────
//
// Local copy of the same flow used in the reading editor's GeneratePanel.
// Slightly different layout (inline, not a popover) and slightly different
// surrounding-text handling (we use the lesson title + prompt for context
// because an ai_generated block has no neighboring prose).

function GeneratePanel({
  lessonId,
  blockId,
  lessonTitle,
  lessonPrompt,
  onGenerated,
  onCancel,
}: {
  lessonId: string;
  blockId: string;
  lessonTitle: string;
  lessonPrompt: string;
  onGenerated: (s: AISegment) => void;
  onCancel: (() => void) | null;
}) {
  const [subKind, setSubKind] = useState<SubKind>("paragraph");
  const [brief, setBrief] = useState("");
  const [teacherData, setTeacherData] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(): void {
    setError(null);
    if (brief.trim().length === 0) {
      setError("Brief is required.");
      return;
    }

    type ChartReq = {
      sub_kind: "chart";
      brief: string;
      teacher_data?: string;
      surrounding_text: string;
    };
    type Req =
      | { sub_kind: "paragraph"; brief: string; surrounding_text: string }
      | ChartReq
      | { sub_kind: "diagram"; brief: string; surrounding_text: string };

    const surrounding = `Lesson: ${lessonTitle}\nQuestion: ${lessonPrompt}`;
    const request: Req =
      subKind === "chart"
        ? {
            sub_kind: "chart",
            brief: brief.trim(),
            teacher_data: teacherData.trim() || undefined,
            surrounding_text: surrounding,
          }
        : subKind === "diagram"
          ? {
              sub_kind: "diagram",
              brief: brief.trim(),
              surrounding_text: surrounding,
            }
          : {
              sub_kind: "paragraph",
              brief: brief.trim(),
              surrounding_text: surrounding,
            };

    startTransition(async () => {
      try {
        const res = await fetch("/api/teacher/generate-segment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lesson_id: lessonId,
            block_id: blockId,
            lesson_title: lessonTitle,
            lesson_prompt: lessonPrompt,
            request,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `Generation failed (${res.status})`);
          return;
        }
        const json = (await res.json()) as { segment: Segment };
        if (json.segment.kind !== "ai") {
          setError("Unexpected non-AI segment in response");
          return;
        }
        // Persist immediately so the page revalidate picks it up.
        await saveAIGeneratedSegment(lessonId, blockId, json.segment);
        onGenerated(json.segment);
        setBrief("");
        setTeacherData("");
      } catch (err) {
        setError(String(err));
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {(["paragraph", "chart", "diagram"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSubKind(k)}
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: subKind === k ? tokens.color.text : tokens.color.ter,
              padding: "4px 12px",
              border: `1px solid ${subKind === k ? tokens.color.text : tokens.color.border}`,
              background: subKind === k ? tokens.color.panel : "transparent",
              fontFamily: tokens.font.ui,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: 2,
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={2}
        placeholder={
          subKind === "paragraph"
            ? "e.g. background paragraph on the political situation in 1788"
            : subKind === "chart"
              ? "e.g. wheat prices in France 1780–1789"
              : "e.g. relationships between Estates-General, monarchy, and Third Estate"
        }
        style={{
          width: "100%",
          padding: "6px 8px",
          fontSize: 13,
          fontFamily: tokens.font.body,
          color: tokens.color.text,
          background: tokens.color.panel,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: 2,
          outline: "none",
          resize: "vertical",
          marginBottom: 8,
        }}
      />

      {subKind === "chart" && (
        <textarea
          value={teacherData}
          onChange={(e) => setTeacherData(e.target.value)}
          rows={3}
          placeholder={
            "Your data (optional). Paste CSV/JSON/prose and it'll be used\n" +
            "verbatim and labeled 'teacher-supplied'. Leave blank to let the\n" +
            "AI propose data (labeled 'AI-proposed illustrative' with a caveat)."
          }
          style={{
            width: "100%",
            padding: "6px 8px",
            fontSize: 12,
            fontFamily: tokens.font.mono,
            color: tokens.color.text,
            background: tokens.color.panel,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: 2,
            outline: "none",
            resize: "vertical",
            marginBottom: 8,
          }}
        />
      )}

      {error && (
        <div
          style={{
            padding: "6px 10px",
            background: tokens.color.flagBg,
            border: `1px solid ${tokens.color.flagBd}`,
            color: tokens.color.flagText,
            fontFamily: tokens.font.body,
            fontSize: 11,
            marginBottom: 8,
            borderRadius: 2,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: tokens.color.ter,
              padding: "4px 12px",
              border: `1px solid ${tokens.color.border}`,
              background: "transparent",
              fontFamily: tokens.font.ui,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: pending ? "default" : "pointer",
              borderRadius: 2,
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || brief.trim().length === 0}
          style={{
            fontSize: 9,
            fontWeight: 700,
            color:
              pending || brief.trim().length === 0
                ? tokens.color.faint
                : tokens.color.text,
            padding: "4px 14px",
            border: `1px solid ${tokens.color.text}`,
            background: tokens.color.panel,
            fontFamily: tokens.font.ui,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor:
              pending || brief.trim().length === 0 ? "default" : "pointer",
            borderRadius: 2,
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Generating…" : `Generate ${subKind}`}
        </button>
      </div>
    </div>
  );
}
