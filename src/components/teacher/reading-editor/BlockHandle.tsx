"use client";

// BlockHandle — Notion-style per-block gutter control for the reading
// editor. Hovering a top-level block shows a ⋮⋮ handle in the left
// gutter; clicking opens a small action menu scoped to that block:
// move up / move down / insert AI segment below / delete.
//
// Deliberate omissions: no "duplicate" (it would clone an AI segment's
// id and read as a second, separately-generated segment — provenance
// ambiguity), and no "turn into" (human ↔ AI conversion is structurally
// forbidden; provenance only changes through the generation API).

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { tokens } from "@/lib/design/tokens";

type HoverTarget = {
  index: number;
  // Top offset relative to the positioning wrapper.
  top: number;
};

type Props = {
  editor: Editor;
  // The positioned ancestor the handle is absolutely placed within.
  wrapperRef: React.RefObject<HTMLDivElement | null>;
};

// Absolute start position of the top-level child at `index`.
function blockRange(
  editor: Editor,
  index: number,
): { from: number; to: number } | null {
  const doc = editor.state.doc;
  if (index < 0 || index >= doc.childCount) return null;
  let from = 0;
  for (let i = 0; i < index; i++) from += doc.child(i).nodeSize;
  return { from, to: from + doc.child(index).nodeSize };
}

export function BlockHandle({ editor, wrapperRef }: Props) {
  const [target, setTarget] = useState<HoverTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locate = useCallback(
    (clientY: number): HoverTarget | null => {
      const wrapper = wrapperRef.current;
      if (!wrapper || editor.isDestroyed) return null;
      const wrapperRect = wrapper.getBoundingClientRect();
      const doc = editor.state.doc;
      let offset = 0;
      for (let i = 0; i < doc.childCount; i++) {
        const dom = editor.view.nodeDOM(offset);
        offset += doc.child(i).nodeSize;
        if (!(dom instanceof HTMLElement)) continue;
        const rect = dom.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          return { index: i, top: rect.top - wrapperRect.top };
        }
      }
      return null;
    },
    [editor, wrapperRef],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function onMove(e: MouseEvent): void {
      if (menuOpen) return;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      const found = locate(e.clientY);
      setTarget((prev) =>
        found?.index === prev?.index && found?.top === prev?.top
          ? prev
          : found,
      );
    }
    function onLeave(): void {
      if (menuOpen) return;
      hideTimer.current = setTimeout(() => setTarget(null), 250);
    }

    wrapper.addEventListener("mousemove", onMove);
    wrapper.addEventListener("mouseleave", onLeave);
    return () => {
      wrapper.removeEventListener("mousemove", onMove);
      wrapper.removeEventListener("mouseleave", onLeave);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [locate, menuOpen, wrapperRef]);

  // Any doc change invalidates the cached index/offset.
  useEffect(() => {
    const close = (): void => {
      setMenuOpen(false);
      setTarget(null);
    };
    editor.on("update", close);
    return () => {
      editor.off("update", close);
    };
  }, [editor]);

  if (!target) return null;

  const index = target.index;
  const childCount = editor.state.doc.childCount;

  function move(dir: -1 | 1): void {
    const range = blockRange(editor, index);
    const swapRange = blockRange(editor, index + dir);
    if (!range || !swapRange) return;
    const node = editor.state.doc.child(index);
    const tr = editor.state.tr;
    tr.delete(range.from, range.to);
    const insertAt =
      dir === -1
        ? swapRange.from
        : range.from + (swapRange.to - swapRange.from);
    tr.insert(insertAt, node);
    editor.view.dispatch(tr);
    setMenuOpen(false);
    setTarget(null);
  }

  function insertAIBelow(): void {
    const range = blockRange(editor, index);
    if (!range) return;
    editor
      .chain()
      .focus()
      .insertContentAt(range.to, {
        type: "aiPrompt",
        attrs: { subKind: "paragraph" },
      })
      .run();
    setMenuOpen(false);
    setTarget(null);
  }

  function removeBlock(): void {
    const range = blockRange(editor, index);
    if (!range) return;
    editor.chain().focus().deleteRange(range).run();
    setMenuOpen(false);
    setTarget(null);
  }

  const itemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "6px 12px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontFamily: tokens.font.ui,
    fontSize: 10,
    fontWeight: 600,
    color: tokens.color.text,
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
    borderRadius: 3,
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 2,
        top: target.top,
        zIndex: 50,
      }}
      onMouseEnter={() => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
      }}
      onMouseLeave={() => {
        if (!menuOpen) setTarget(null);
      }}
    >
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        title="Block actions"
        aria-label="Block actions"
        style={{
          width: 20,
          height: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: 3,
          background: menuOpen ? tokens.color.margin : "transparent",
          color: tokens.color.faint,
          cursor: "grab",
          fontSize: 12,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ⋮⋮
      </button>

      {menuOpen && (
        <div
          style={{
            position: "absolute",
            left: 22,
            top: 0,
            minWidth: 190,
            background: tokens.color.panel,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: 4,
            boxShadow: tokens.shadowMd,
            padding: 4,
          }}
        >
          <button
            type="button"
            style={{ ...itemStyle, opacity: index === 0 ? 0.4 : 1 }}
            disabled={index === 0}
            onMouseDown={(e) => {
              e.preventDefault();
              move(-1);
            }}
          >
            ↑ Move up
          </button>
          <button
            type="button"
            style={{
              ...itemStyle,
              opacity: index >= childCount - 1 ? 0.4 : 1,
            }}
            disabled={index >= childCount - 1}
            onMouseDown={(e) => {
              e.preventDefault();
              move(1);
            }}
          >
            ↓ Move down
          </button>
          <button
            type="button"
            style={{ ...itemStyle, color: tokens.ai.label }}
            onMouseDown={(e) => {
              e.preventDefault();
              insertAIBelow();
            }}
          >
            {tokens.aiMarker} Insert AI segment below
          </button>
          <div
            style={{
              height: 1,
              background: tokens.color.border,
              margin: "4px 6px",
            }}
          />
          <button
            type="button"
            style={{ ...itemStyle, color: tokens.color.flagText }}
            onMouseDown={(e) => {
              e.preventDefault();
              removeBlock();
            }}
          >
            ✕ Delete block
          </button>
        </div>
      )}
    </div>
  );
}
