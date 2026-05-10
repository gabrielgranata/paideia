"use client";

// Generate panel — the surface the teacher uses to ask the lesson-content
// composer for an AI segment. Three sub-kinds: paragraph, chart, diagram.
//
// Voice: the panel is "ready-to-hand" — opens inline, dismissible, the
// teacher's prose stays foreground when it's closed. No modal overlay,
// no chat history; one request at a time, drop the result at the cursor.
//
// The brief field is plain text. The chart form has an optional
// teacher_data textarea — if filled, the composer treats it as the
// authoritative data source (data_source.kind = "teacher_supplied").

import { useState, useTransition } from "react";
import { tokens } from "@/lib/design/tokens";
import type { Segment } from "@/lib/lesson-blocks";

type SubKind = "paragraph" | "chart" | "diagram";

type Props = {
  lessonId: string;
  blockId: string;
  lessonTitle: string;
  lessonPrompt: string;
  // Returns the text near the cursor so the composer gets some context.
  // Empty string is fine for the first segment of an empty reading.
  getSurroundingText: () => string;
  onGenerated: (segment: Segment) => void;
  onClose: () => void;
};

export function GeneratePanel({
  lessonId,
  blockId,
  lessonTitle,
  lessonPrompt,
  getSurroundingText,
  onGenerated,
  onClose,
}: Props) {
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

    const surrounding = getSurroundingText();
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
        onGenerated(json.segment);
        // Reset for next call
        setBrief("");
        setTeacherData("");
        onClose();
      } catch (err) {
        setError(String(err));
      }
    });
  }

  return (
    <div
      style={{
        margin: "10px 0 16px",
        padding: 14,
        borderLeft: `3px solid ${tokens.color.border}`,
        background: tokens.color.margin,
        borderRadius: "0 3px 3px 0",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
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
          {tokens.aiMarker} Generate segment
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginLeft: "auto",
            fontSize: 9,
            color: tokens.color.faint,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: tokens.font.ui,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          ✕ Close
        </button>
      </header>

      {/* Sub-kind toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
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

      <label
        style={{
          display: "block",
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.ter,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 4,
          fontFamily: tokens.font.ui,
        }}
      >
        Brief — what should the {subKind} cover?
      </label>
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
          marginBottom: 10,
        }}
      />

      {subKind === "chart" && (
        <>
          <label
            style={{
              display: "block",
              fontSize: 9,
              fontWeight: 700,
              color: tokens.color.ter,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 4,
              fontFamily: tokens.font.ui,
            }}
          >
            Your data (optional) — CSV, JSON, or prose
          </label>
          <textarea
            value={teacherData}
            onChange={(e) => setTeacherData(e.target.value)}
            rows={3}
            placeholder={
              "If you paste data here it'll be used verbatim and labeled\n" +
              "'teacher-supplied'. Leave blank and the AI will propose data\n" +
              "(labeled 'AI-proposed illustrative' with a caveat)."
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
              marginBottom: 10,
            }}
          />
        </>
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
            marginBottom: 10,
            borderRadius: 2,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          type="button"
          onClick={submit}
          disabled={pending || brief.trim().length === 0}
          style={{
            fontSize: 10,
            fontWeight: 700,
            color:
              pending || brief.trim().length === 0
                ? tokens.color.faint
                : tokens.color.text,
            padding: "6px 14px",
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
