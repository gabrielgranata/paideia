"use client";

// ReadingDocEditor — TipTap-based editor for one reading block, with a
// Notion-style editing surface:
//
//   - StarterKit handles paragraph / bold / italic / etc. The default
//     `paragraph` node serves as a human-authored segment.
//   - Three custom block nodes (aiParagraph, aiChart, aiDiagram) represent
//     AI-authored segments. The Segment data lives on the node's `segment`
//     attr; NodeViews render the provenance UI inline.
//   - A transient `aiPrompt` node is the in-flow AI widget: the slash
//     menu and block handle insert it; generating replaces it with a real
//     segment; it never serializes.
//   - Typing "/" in a plain paragraph opens the slash command menu
//     (SlashMenu.tsx). Hovering a block shows the ⋮⋮ gutter handle
//     (BlockHandle.tsx) with move / insert-below / delete actions.
//   - On every change, the editor serializes its JSON to a Doc and
//     debounce-saves via the saveReadingDoc server action.
//
// Provenance discipline enforced here:
//   - There is NO command to convert a human paragraph into an AI segment.
//     AI segments only enter via the aiPrompt widget, which goes through
//     /api/teacher/generate-segment (which server-attaches generation
//     metadata). The teacher cannot forge a generation stamp from inside
//     the editor.
//   - There is NO "rewrite with AI" / "polish" / "continue writing"
//     command anywhere in the slash menu or block handle. The teacher's
//     words are the teacher's words.

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { saveReadingDoc } from "@/app/actions/teacher";
import { tokens } from "@/lib/design/tokens";
import {
  AIParagraphExtension,
  AIChartExtension,
  AIDiagramExtension,
  AIPromptExtension,
} from "./reading-editor/extensions";
import {
  docToEditorContent,
  editorJsonToDoc,
} from "./reading-editor/serialize";
import {
  SlashMenu,
  computeSlashState,
  filterSlashItems,
  type SlashItem,
  type SlashState,
} from "./reading-editor/SlashMenu";
import { BlockHandle } from "./reading-editor/BlockHandle";
import type { Doc } from "@/lib/lesson-blocks";

const SAVE_DEBOUNCE_MS = 700;

type Props = {
  lessonId: string;
  blockId: string;
  lessonTitle: string;
  lessonPrompt: string;
  initialDoc: Doc;
};

type PromptSubKind = "paragraph" | "chart" | "diagram";

const SLASH_TO_SUBKIND: Partial<Record<SlashItem["kind"], PromptSubKind>> = {
  ai_paragraph: "paragraph",
  ai_chart: "chart",
  ai_diagram: "diagram",
};

// Insert the transient AI prompt widget at the current selection. If the
// caret sits in an empty plain paragraph, the widget replaces it (the
// Notion feel: the empty line becomes the widget); otherwise it lands
// after the current top-level block, never splitting the teacher's prose.
function insertPromptWidget(editor: Editor, subKind: PromptSubKind): void {
  const { state } = editor;
  const $from = state.selection.$from;
  const node = { type: "aiPrompt", attrs: { subKind } };
  if (
    $from.depth === 1 &&
    $from.parent.type.name === "paragraph" &&
    $from.parent.content.size === 0
  ) {
    editor
      .chain()
      .insertContentAt({ from: $from.before(1), to: $from.after(1) }, node)
      .run();
    return;
  }
  if ($from.depth >= 1) {
    editor.chain().insertContentAt($from.after(1), node).run();
    return;
  }
  editor.chain().insertContentAt(state.selection.to, node).run();
}

export function ReadingDocEditor({
  lessonId,
  blockId,
  lessonTitle,
  lessonPrompt,
  initialDoc,
}: Props) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Slash menu state. Refs mirror state so the editor's handleKeyDown
  // (bound once at creation) always sees current values.
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashRef = useRef<SlashState | null>(null);
  const slashIndexRef = useRef(0);
  // Esc-dismissed trigger: stays closed until the query text changes.
  const dismissedRef = useRef<{ from: number; query: string } | null>(null);
  slashRef.current = slash;
  slashIndexRef.current = slashIndex;

  const runSlashCommand = useCallback((editor: Editor, item: SlashItem) => {
    const active = slashRef.current;
    if (!active) return;
    dismissedRef.current = null;
    editor.chain().focus().deleteRange(active.range).run();
    setSlash(null);
    setSlashIndex(0);
    const subKind = SLASH_TO_SUBKIND[item.kind];
    if (!subKind) return; // "text": slash text removed, paragraph stays
    insertPromptWidget(editor, subKind);
  }, []);

  const syncSlash = useCallback((editor: Editor) => {
    const next = computeSlashState(editor);
    const dismissed = dismissedRef.current;
    if (
      next &&
      dismissed &&
      dismissed.from === next.range.from &&
      dismissed.query === next.query
    ) {
      setSlash(null);
      return;
    }
    if (next?.query !== slashRef.current?.query) setSlashIndex(0);
    setSlash(next);
    if (!next) dismissedRef.current = null;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // We don't use top-level headings in readings — keep the shape
        // a flat sequence of paragraphs and AI segments.
        heading: false,
        // Block quote is handy for source excerpts; keep it on.
      }),
      Placeholder.configure({
        placeholder:
          "Write the reading. Type / for blocks — text or ◆ AI segments.",
      }),
      AIParagraphExtension,
      AIChartExtension,
      AIDiagramExtension,
      AIPromptExtension.configure({
        lessonId,
        blockId,
        lessonTitle,
        lessonPrompt,
      }),
    ],
    content: docToEditorContent(initialDoc) as unknown as Record<string, unknown>,
    immediatelyRender: false, // Next.js SSR compatibility
    editorProps: {
      handleKeyDown: (view, event) => {
        const active = slashRef.current;
        if (!active) return false;
        const items = filterSlashItems(active.query);
        if (items.length === 0) return false;
        if (event.key === "ArrowDown") {
          setSlashIndex((slashIndexRef.current + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSlashIndex(
            (slashIndexRef.current - 1 + items.length) % items.length,
          );
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          const item = items[Math.min(slashIndexRef.current, items.length - 1)];
          // The editor instance is stable; grab it from the ref'd view.
          if (editorRef.current) runSlashCommand(editorRef.current, item);
          return true;
        }
        if (event.key === "Escape") {
          dismissedRef.current = {
            from: active.range.from,
            query: active.query,
          };
          setSlash(null);
          return true;
        }
        return false;
      },
    },
    onTransaction: ({ editor }) => {
      syncSlash(editor);
    },
    onBlur: () => {
      // Let a click inside the menu land first (menu uses onMouseDown).
      setTimeout(() => setSlash(null), 120);
    },
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveStatus("idle");
      const json = editor.getJSON();
      saveTimer.current = setTimeout(() => {
        const doc = editorJsonToDoc(json);
        setSaveStatus("saving");
        startTransition(async () => {
          try {
            await saveReadingDoc(lessonId, blockId, doc);
            setSaveStatus("saved");
          } catch (err) {
            console.error("[ReadingDocEditor] save failed:", err);
            setSaveStatus("error");
          }
        });
      }, SAVE_DEBOUNCE_MS);
    },
  });

  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // The slash menu is fixed-positioned at the caret; keep it anchored
  // while the editor body scrolls.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !editor) return;
    function onScroll(): void {
      if (slashRef.current && editor) syncSlash(editor);
    }
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [editor, syncSlash]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 24px",
          gap: 10,
          borderBottom: `1px solid ${tokens.color.border}`,
          background: tokens.color.cardLight,
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (!editor) return;
            editor.commands.focus();
            insertPromptWidget(editor, "paragraph");
          }}
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: tokens.color.text,
            padding: "5px 12px",
            border: `1px solid ${tokens.color.text}`,
            background: tokens.color.panel,
            fontFamily: tokens.font.ui,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            borderRadius: 2,
          }}
        >
          {tokens.aiMarker} Insert AI segment
        </button>

        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 9,
            color: tokens.color.faint,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Type / for commands · hover a block for actions
        </span>

        <span
          style={{
            marginLeft: "auto",
            fontFamily: tokens.font.ui,
            fontSize: 9,
            color: tokens.color.faint,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && "Save failed"}
          {saveStatus === "idle" && "Edits autosave"}
        </span>
      </div>

      {/* Body — editor surface with block-handle gutter */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 36px",
          background: tokens.color.panel,
        }}
      >
        <div
          ref={wrapperRef}
          style={{
            position: "relative",
            paddingLeft: 26, // gutter for the ⋮⋮ block handle
          }}
        >
          {editor && <BlockHandle editor={editor} wrapperRef={wrapperRef} />}
          <EditorContent
            editor={editor}
            style={{
              fontFamily: tokens.font.body,
              fontSize: 15,
              lineHeight: 1.75,
              color: tokens.color.text,
            }}
          />
        </div>
      </div>

      {slash && (
        <SlashMenu
          state={slash}
          selectedIndex={slashIndex}
          onHover={(i) => setSlashIndex(i)}
          onSelect={(item) => {
            if (editorRef.current) runSlashCommand(editorRef.current, item);
          }}
        />
      )}
    </div>
  );
}
