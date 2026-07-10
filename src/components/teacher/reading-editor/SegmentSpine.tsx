"use client";

// SegmentSpine — the manuscript's margin rail. One row per top-level
// segment: a plain rule for the teacher's prose, an olive ◆ for AI
// segments. Clicking a row scrolls to and focuses that block. Below the
// spine sits the composition ledger: how much of this reading is the
// teacher's own words vs. AI-generated — provenance made ambient, so
// the teacher never loses sight of whose voice the manuscript carries.
//
// The spine is derived state only. It never edits; it points.

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { tokens } from "@/lib/design/tokens";

type SpineItem = {
  type: "human" | "ai-paragraph" | "ai-chart" | "ai-diagram" | "ai-prompt";
  preview: string;
  words: number;
};

const GLYPH: Record<SpineItem["type"], string> = {
  human: "—",
  "ai-paragraph": "◆",
  "ai-chart": "◆",
  "ai-diagram": "◆",
  "ai-prompt": "◇",
};

const TYPE_LABEL: Record<SpineItem["type"], string> = {
  human: "your prose",
  "ai-paragraph": "AI paragraph",
  "ai-chart": "AI chart",
  "ai-diagram": "AI diagram",
  "ai-prompt": "pending brief",
};

function deriveItems(editor: Editor): SpineItem[] {
  const items: SpineItem[] = [];
  editor.state.doc.forEach((node) => {
    const text = node.textContent.trim();
    const words = text ? text.split(/\s+/).length : 0;
    switch (node.type.name) {
      case "paragraph":
        items.push({
          type: "human",
          preview: text || "(empty line)",
          words,
        });
        break;
      case "aiParagraph":
        items.push({ type: "ai-paragraph", preview: text, words });
        break;
      case "aiChart": {
        const seg = node.attrs.segment as { caption?: string } | null;
        items.push({
          type: "ai-chart",
          preview: seg?.caption ?? "chart",
          words: 0,
        });
        break;
      }
      case "aiDiagram": {
        const seg = node.attrs.segment as { caption?: string } | null;
        items.push({
          type: "ai-diagram",
          preview: seg?.caption ?? "diagram",
          words: 0,
        });
        break;
      }
      case "aiPrompt":
        items.push({ type: "ai-prompt", preview: "generating…", words: 0 });
        break;
      default:
        break;
    }
  });
  return items;
}

function jumpTo(editor: Editor, index: number): void {
  const doc = editor.state.doc;
  if (index >= doc.childCount) return;
  let offset = 0;
  for (let i = 0; i < index; i++) offset += doc.child(i).nodeSize;
  const dom = editor.view.nodeDOM(offset);
  if (dom instanceof HTMLElement) {
    dom.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  // Land the caret at the block start so keyboard flow continues there.
  editor.chain().focus(offset + 1).run();
}

type Props = {
  editor: Editor;
  // Preview mode renders the student view; the spine stays visible as a
  // map but stops steering the (unmounted) editor DOM.
  interactive: boolean;
  onInsertAI: () => void;
};

export function SegmentSpine({ editor, interactive, onInsertAI }: Props) {
  const [items, setItems] = useState<SpineItem[]>(() => deriveItems(editor));

  useEffect(() => {
    const update = (): void => setItems(deriveItems(editor));
    update();
    editor.on("transaction", update);
    return () => {
      editor.off("transaction", update);
    };
  }, [editor]);

  const visible = items.filter(
    (it) => !(it.type === "human" && it.preview === "(empty line)"),
  );
  const humanCount = visible.filter((it) => it.type === "human").length;
  const aiCount = visible.filter(
    (it) => it.type !== "human" && it.type !== "ai-prompt",
  ).length;
  const humanWords = items
    .filter((it) => it.type === "human")
    .reduce((n, it) => n + it.words, 0);
  const aiWords = items
    .filter((it) => it.type === "ai-paragraph")
    .reduce((n, it) => n + it.words, 0);
  const totalWords = humanWords + aiWords;
  const humanShare =
    totalWords === 0 ? null : Math.round((humanWords / totalWords) * 100);

  return (
    <nav
      aria-label="Reading structure"
      style={{
        width: 190,
        flexShrink: 0,
        position: "sticky",
        top: 24,
        alignSelf: "flex-start",
        maxHeight: "calc(100vh - 120px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: tokens.color.faint,
          marginBottom: 10,
        }}
      >
        The reading
      </div>

      <div style={{ overflowY: "auto", minHeight: 0 }}>
        {items.map((item, i) => {
          if (item.type === "human" && item.preview === "(empty line)") {
            return null;
          }
          const isAI = item.type !== "human";
          return (
            <button
              key={i}
              type="button"
              className="pd-spine-row"
              disabled={!interactive}
              onClick={() => interactive && jumpTo(editor, i)}
              title={TYPE_LABEL[item.type]}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 7,
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderLeft: `2px solid ${
                  isAI ? tokens.ai.border : tokens.color.border
                }`,
                padding: "4px 0 4px 9px",
                margin: 0,
                cursor: interactive ? "pointer" : "default",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: 8,
                  color: isAI ? tokens.ai.label : tokens.color.faint,
                  flexShrink: 0,
                }}
              >
                {GLYPH[item.type]}
              </span>
              <span
                style={{
                  fontFamily: tokens.font.body,
                  fontSize: 11.5,
                  lineHeight: 1.35,
                  color: isAI ? tokens.ai.text : tokens.color.sec,
                  fontStyle: isAI ? "italic" : "normal",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {item.preview}
              </span>
            </button>
          );
        })}
      </div>

      {/* Composition ledger — whose voice is this manuscript? */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: `1px solid ${tokens.color.border}`,
          fontFamily: tokens.font.ui,
          fontSize: 9,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: tokens.color.ter,
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        <span>
          {humanCount} yours · {aiCount} AI {tokens.aiMarker}
        </span>
        {totalWords > 0 && <span>{totalWords.toLocaleString()} words</span>}
        {humanShare !== null && (
          <span title="Share of the reading's words written by you">
            {humanShare}% your words
          </span>
        )}
      </div>

      {interactive && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={onInsertAI}
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: tokens.ai.label,
              padding: "5px 10px",
              border: `1px solid ${tokens.ai.border}`,
              background: "transparent",
              fontFamily: tokens.font.ui,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: 2,
            }}
          >
            {tokens.aiMarker} AI segment
          </button>
          <div
            style={{
              marginTop: 8,
              fontFamily: tokens.font.ui,
              fontSize: 8,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: tokens.color.faint,
              lineHeight: 1.7,
            }}
          >
            Type / for blocks
            <br />
            Hover a block for actions
          </div>
        </div>
      )}
    </nav>
  );
}
