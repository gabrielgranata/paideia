"use client";

// SlashMenu — Notion-style command menu for the reading editor.
//
// Typing "/" in a plain (human) paragraph opens this menu at the caret;
// typing filters it; ↑/↓/↵ navigate and insert; Esc dismisses. The menu
// is deliberately small: plain text plus the three AI segment kinds,
// grouped the way familiar editors group them ("Basic", then the AI
// blocks under an explicit provenance banner). No command edits
// existing prose — every item INSERTS, and AI items insert the
// transient prompt widget (which routes through the provenance-
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
  glyph: string;
  group: "basic" | "ai";
};

export const SLASH_ITEMS: SlashItem[] = [
  {
    kind: "text",
    title: "Text",
    hint: "Plain paragraph, your words",
    keywords: ["text", "paragraph", "plain"],
    glyph: "T",
    group: "basic",
  },
  {
    kind: "ai_paragraph",
    title: "AI paragraph",
    hint: "Generated prose",
    keywords: ["ai", "paragraph", "generate", "prose"],
    glyph: "◆",
    group: "ai",
  },
  {
    kind: "ai_chart",
    title: "AI chart",
    hint: "Generated chart, data source labeled",
    keywords: ["ai", "chart", "graph", "data", "figure"],
    glyph: "▥",
    group: "ai",
  },
  {
    kind: "ai_diagram",
    title: "AI diagram",
    hint: "Generated concept map",
    keywords: ["ai", "diagram", "map", "concept"],
    glyph: "◈",
    group: "ai",
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

const GROUP_LABEL: Record<SlashItem["group"], string> = {
  basic: "Basic",
  ai: "◆ AI — provenance recorded",
};

export function SlashMenu({ state, selectedIndex, onSelect, onHover }: Props) {
  const items = filterSlashItems(state.query);
  const ref = useRef<HTMLDivElement | null>(null);

  // Keep the selected row visible when navigating with the keyboard.
  useEffect(() => {
    const el = ref.current?.querySelector(
      `[data-slash-index="${selectedIndex}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (items.length === 0) return null;

  const rows: React.ReactNode[] = [];
  let lastGroup: SlashItem["group"] | null = null;
  items.forEach((item, i) => {
    if (item.group !== lastGroup) {
      lastGroup = item.group;
      rows.push(
        <div
          key={`g-${item.group}`}
          style={{
            padding: "7px 10px 3px",
            fontFamily: tokens.font.ui,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: item.group === "ai" ? tokens.ai.label : tokens.color.faint,
          }}
        >
          {GROUP_LABEL[item.group]}
        </div>,
      );
    }
    const selected = i === selectedIndex;
    rows.push(
      <button
        key={item.kind}
        type="button"
        data-slash-index={i}
        onMouseEnter={() => onHover(i)}
        // mousedown, not click — click fires after the editor takes
        // back focus and the menu has already closed.
        onMouseDown={(e) => {
          e.preventDefault();
          onSelect(item);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          textAlign: "left",
          padding: "6px 10px",
          border: "none",
          borderRadius: 3,
          cursor: "pointer",
          background: selected ? tokens.color.margin : "transparent",
        }}
      >
        {/* Icon tile — the familiar block-menu glyph square */}
        <span
          aria-hidden="true"
          style={{
            width: 24,
            height: 24,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 3,
            border: `1px solid ${
              item.group === "ai" ? tokens.ai.border : tokens.color.border
            }`,
            background: tokens.color.cardLight,
            fontFamily:
              item.group === "ai" ? tokens.font.ui : tokens.font.display,
            fontSize: item.group === "ai" ? 10 : 13,
            color: item.group === "ai" ? tokens.ai.label : tokens.color.sec,
          }}
        >
          {item.glyph}
        </span>
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontFamily: tokens.font.ui,
              fontSize: 11,
              fontWeight: 700,
              color:
                item.group === "ai" ? tokens.ai.label : tokens.color.text,
              letterSpacing: "0.04em",
            }}
          >
            {item.title}
          </span>
          <span
            style={{
              display: "block",
              fontFamily: tokens.font.ui,
              fontSize: 9,
              color: tokens.color.faint,
              letterSpacing: "0.04em",
            }}
          >
            {item.hint}
          </span>
        </span>
        {selected && (
          <kbd
            style={{
              marginLeft: "auto",
              fontFamily: tokens.font.ui,
              fontSize: 8,
              color: tokens.color.faint,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: 3,
              padding: "1px 5px",
              background: tokens.color.cardLight,
            }}
          >
            ↵
          </kbd>
        )}
      </button>,
    );
  });

  return (
    <div
      ref={ref}
      className="pd-pop"
      style={{
        position: "fixed",
        left: state.coords.left,
        top: state.coords.bottom + 6,
        zIndex: 60,
        width: 280,
        maxHeight: 320,
        overflowY: "auto",
        background: tokens.color.panel,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 6,
        boxShadow: tokens.shadowMd,
        padding: 4,
      }}
    >
      {rows}
      <div
        style={{
          marginTop: 2,
          padding: "6px 10px 4px",
          borderTop: `1px solid ${tokens.color.border}`,
          fontFamily: tokens.font.ui,
          fontSize: 8,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: tokens.color.faint,
          display: "flex",
          gap: 12,
        }}
      >
        <span>↑↓ navigate</span>
        <span>↵ insert</span>
        <span>esc dismiss</span>
      </div>
    </div>
  );
}
