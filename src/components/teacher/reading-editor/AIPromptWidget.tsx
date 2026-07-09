"use client";

// AIPromptWidget — NodeView for the transient `aiPrompt` node: the
// in-flow "AI widget" the slash menu and block handle insert. Renders a
// brief input exactly where the segment will land; on generate it calls
// /api/teacher/generate-segment (server attaches the generation stamp)
// and replaces itself with the returned segment node. Cancel or Esc
// removes it without a trace — the serializer never persists this node.
//
// Provenance discipline: this widget composes *requests*, never
// segments. It has no path to write a generation stamp, and it never
// touches existing prose — the teacher's words are the teacher's words.

import {
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { tokens } from "@/lib/design/tokens";
import type { Segment } from "@/lib/lesson-blocks";
import type { AIPromptOptions } from "./extensions";

type SubKind = "paragraph" | "chart" | "diagram";

const SUB_KINDS: { key: SubKind; label: string }[] = [
  { key: "paragraph", label: "Paragraph" },
  { key: "chart", label: "Chart" },
  { key: "diagram", label: "Diagram" },
];

const PLACEHOLDER: Record<SubKind, string> = {
  paragraph: "e.g. background paragraph on the political situation in 1788",
  chart: "e.g. wheat prices in France 1780–1789",
  diagram:
    "e.g. relationships between Estates-General, monarchy, and Third Estate",
};

// Convert a generated Segment into the TipTap node JSON for insertion.
// Mirrors ReadingDocEditor.insertSegment; kept local so the widget can
// replace itself in one transaction.
function segmentToInsertable(segment: Segment): Record<string, unknown> {
  if (segment.kind === "human") {
    return {
      type: "paragraph",
      attrs: { id: segment.id },
      content: segment.body
        ? [{ type: "text", text: segment.body }]
        : undefined,
    };
  }
  if (segment.sub_kind === "paragraph") {
    return {
      type: "aiParagraph",
      attrs: { id: segment.id, segment },
      content: segment.body
        ? [{ type: "text", text: segment.body }]
        : undefined,
    };
  }
  if (segment.sub_kind === "chart") {
    return { type: "aiChart", attrs: { id: segment.id, segment } };
  }
  return { type: "aiDiagram", attrs: { id: segment.id, segment } };
}

export function AIPromptWidget({
  node,
  editor,
  getPos,
  deleteNode,
  updateAttributes,
  extension,
}: NodeViewProps) {
  const options = extension.options as AIPromptOptions;
  const subKind = (node.attrs.subKind ?? "paragraph") as SubKind;
  const [brief, setBrief] = useState("");
  const [teacherData, setTeacherData] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const briefRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // The widget is invoked deliberately (slash command or handle), so
    // focus moves into the brief — interactional friction stays low.
    // Deferred a tick: ProseMirror restores selection to the editor DOM
    // right after the insert transaction, which would steal an
    // immediate focus() back from the textarea.
    const t = setTimeout(() => briefRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  function surroundingText(): string {
    const full = editor.getText();
    if (full.length <= 600) return full;
    const pos = typeof getPos === "function" ? (getPos() ?? 0) : 0;
    const start = Math.max(0, pos - 300);
    const end = Math.min(editor.state.doc.content.size, pos + 300);
    try {
      return editor.state.doc.textBetween(start, end, " ");
    } catch {
      return full.slice(0, 600);
    }
  }

  function generate(): void {
    setError(null);
    if (brief.trim().length === 0) {
      setError("Brief is required.");
      return;
    }
    const surrounding = surroundingText();
    const request =
      subKind === "chart"
        ? {
            sub_kind: "chart" as const,
            brief: brief.trim(),
            teacher_data: teacherData.trim() || undefined,
            surrounding_text: surrounding,
          }
        : {
            sub_kind: subKind,
            brief: brief.trim(),
            surrounding_text: surrounding,
          };

    startTransition(async () => {
      try {
        const res = await fetch("/api/teacher/generate-segment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lesson_id: options.lessonId,
            block_id: options.blockId,
            lesson_title: options.lessonTitle,
            lesson_prompt: options.lessonPrompt,
            request,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(
            (body as { error?: string }).error ??
              `Generation failed (${res.status})`,
          );
          return;
        }
        const json = (await res.json()) as { segment: Segment };
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (pos === undefined) {
          setError("Editor position lost — close and retry.");
          return;
        }
        // Replace this widget with the generated segment in one step.
        editor
          .chain()
          .focus()
          .deleteRange({ from: pos, to: pos + node.nodeSize })
          .insertContentAt(pos, segmentToInsertable(json.segment))
          .run();
      } catch (err) {
        setError(String(err));
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      deleteNode();
      editor.commands.focus();
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      generate();
    }
  }

  const microLabel: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    color: tokens.color.ter,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontFamily: tokens.font.ui,
  };

  return (
    <NodeViewWrapper data-segment-kind="ai-prompt">
      <div
        contentEditable={false}
        onKeyDown={onKeyDown}
        style={{
          margin: "10px 0",
          padding: "12px 14px",
          borderLeft: `3px solid ${tokens.ai.border}`,
          background: tokens.color.margin,
          borderRadius: "0 3px 3px 0",
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
          <span style={{ ...microLabel, color: tokens.ai.label }}>
            {tokens.aiMarker} Generate segment — provenance will be recorded
          </span>
          <button
            type="button"
            onClick={() => {
              deleteNode();
              editor.commands.focus();
            }}
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
              padding: 0,
            }}
          >
            ✕ Cancel
          </button>
        </header>

        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {SUB_KINDS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => updateAttributes({ subKind: key })}
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: subKind === key ? tokens.color.text : tokens.color.ter,
                padding: "4px 12px",
                border: `1px solid ${
                  subKind === key ? tokens.color.text : tokens.color.border
                }`,
                background:
                  subKind === key ? tokens.color.panel : "transparent",
                fontFamily: tokens.font.ui,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                borderRadius: 2,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <label style={{ ...microLabel, display: "block", marginBottom: 4 }}>
          Brief — what should the {subKind} cover?
        </label>
        <textarea
          ref={briefRef}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={2}
          placeholder={PLACEHOLDER[subKind]}
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
          <>
            <label
              style={{ ...microLabel, display: "block", marginBottom: 4 }}
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
                marginBottom: 8,
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
              marginBottom: 8,
              borderRadius: 2,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 9,
              color: tokens.color.faint,
              fontFamily: tokens.font.ui,
              letterSpacing: "0.06em",
            }}
          >
            Esc cancels · ⌘↵ generates
          </span>
          <button
            type="button"
            onClick={generate}
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
    </NodeViewWrapper>
  );
}
