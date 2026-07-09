"use client";

// SlashMenu — Notion-style command menu for the reading editor.
//
// Typing "/" in a plain (human) paragraph opens this menu at the caret;
// typing filters it; ↑/↓/↵ navigate and insert; Esc dismisses. The menu
// is deliberately small: plain text plus the three AI segment kinds. No
// command edits existing prose — every item INSERTS, and AI items insert
// the transient prompt widget (which routes through the provenance-
// stamping API). There is no "rewrite", "polish", or "continue writing"
// command; those are completion affordances and stay out of the catalog.
//
// Detection runs only in top-level plain paragraphs — a "/" inside an
// AI paragraph does not open the menu, so AI-segment editing never
// nests generation.

import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { tokens } from "@/lib/design/tokens";

export type SlashCommandKind =
  | "text"
  | "ai_paragraph"
  | "ai_chart"
  | "ai_diagram";

export type SlashItem = {
  kind: SlashCommandKind;
  title: string;
  hint: string;
  keywords: string[];
  ai: boolean;
};

export const SLASH_ITEMS: SlashItem[] = [
  {
    kind: "text",
    title: "Text",
    hint: "Plain paragraph, your words",
    keywords: ["text", "paragraph", "plain"],
    ai: false,
  },
  {
    kind: "ai_paragraph",
    title: "AI paragraph",
    hint: "Generated prose · provenance recorded",
    keywords: ["ai", "paragraph", "generate", "prose"],
    ai: true,
  },
  {
    kind: "ai_chart",
    title: "AI chart",
    hint: "Generated chart · data source labeled",
    keywords: ["ai", "chart", "graph", "data", "figure"],
    ai: true,
  },
  {
    kind: "ai_diagram",
    title: "AI diagram",
    hint: "Generated concept map · provenance recorded",
    keywords: ["ai", "diagram", "map", "concept"],
    ai: true,
  },
];

export function filterSlashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((item) =>
    item.keywords.some((k) => k.startsWith(q)) ||
    item.title.toLowerCase().includes(q),
  );
}

// The active slash context: where the "/query" text lives in the doc.
export type SlashState = {
  query: string;
  range: { from: number; to: number };
  // Viewport coords of the slash character, from view.coordsAtPos.
  coords: { left: number; bottom: number };
};

// Compute the current slash state from the editor selection, or null if
// no slash trigger is active. Called on every transaction.
export function computeSlashState(editor: Editor): SlashState | null {
  const { state, view } = editor;
  const { selection } = state;
  if (!selection.empty) return null;
  const $from = selection.$from;
  // Top-level plain paragraphs only — never inside AI segments.
  if ($from.depth !== 1) return null;
  if ($from.parent.type.name !== "paragraph") return null;
  const textBefore = $from.parent.textBetween(
    0,
    $from.parentOffset,
    undefined,
    "￼",
  );
  // Slash at block start or after whitespace, then a short query.
  const match = /(?:^|\s)(\/[a-zA-Z]*)$/.exec(textBefore);
  if (!match) return null;
  const slashOffset = match.index + match[0].length - match[1].length;
  const from = $from.start() + slashOffset;
  const to = selection.from;
  let coords: { left: number; bottom: number };
  try {
    const c = view.coordsAtPos(from);
    coords = { left: c.left, bottom: c.bottom };
  } catch {
    return null;
  }
  return { query: match[1].slice(1), range: { from, to }, coords };
}

type Props = {
  state: SlashState;
  selectedIndex: number;
  onSelect: (item: SlashItem) => void;
  onHover: (index: number) => void;
};

export function SlashMenu({ state, selectedIndex, onSelect, onHover }: Props) {
  const items = filterSlashItems(state.query);
  const ref = useRef<HTMLDivElement | null>(null);

  // Keep the selected row visible when navigating with the keyboard.
  useEffect(() => {
    const el = ref.current?.children[selectedIndex] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (items.length === 0) return null;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: state.coords.left,
        top: state.coords.bottom + 6,
        zIndex: 60,
        minWidth: 260,
        maxHeight: 280,
        overflowY: "auto",
        background: tokens.color.panel,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 4,
        boxShadow: tokens.shadowMd,
        padding: 4,
      }}
    >
      {items.map((item, i) => (
        <button
          key={item.kind}
          type="button"
          onMouseEnter={() => onHover(i)}
          // mousedown, not click — click fires after the editor takes
          // back focus and the menu has already closed.
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            width: "100%",
            textAlign: "left",
            padding: "7px 10px",
            border: "none",
            borderRadius: 3,
            cursor: "pointer",
            background:
              i === selectedIndex ? tokens.color.margin : "transparent",
          }}
        >
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 11,
              fontWeight: 700,
              color: item.ai ? tokens.ai.label : tokens.color.text,
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}
          >
            {item.ai ? `${tokens.aiMarker} ` : ""}
            {item.title}
          </span>
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 9,
              color: tokens.color.faint,
              letterSpacing: "0.04em",
            }}
          >
            {item.hint}
          </span>
        </button>
      ))}
    </div>
  );
}
