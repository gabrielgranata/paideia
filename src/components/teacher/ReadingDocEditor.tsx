"use client";

// ReadingDocEditor — the manuscript surface for one reading block.
//
// Layout concept: "the manuscript and its spine." The reading is a
// floating sheet on the parchment canvas, set at reading measure in the
// same typography the student will meet. The lesson's central question
// sits above it as an epigraph — authoring stays anchored to the
// question the reading serves. The left margin carries the segment
// spine (SegmentSpine.tsx): a structural map of the doc where the
// teacher's prose and AI segments are visibly distinct, with a
// composition ledger underneath. Chrome is quiet: save state is a dot,
// not a toolbar.
//
// Editing model (unchanged):
//   - StarterKit paragraphs are human-authored segments.
//   - aiParagraph / aiChart / aiDiagram carry AI segments with their
//     server-set generation stamps; NodeViews render provenance inline.
//   - The transient aiPrompt node is the in-flow AI widget: the slash
//     menu, spine, and block handle insert it; generating replaces it
//     with a real segment; it never serializes.
//   - "/" opens the slash command menu; hovering a block shows the ⋮⋮
//     gutter handle (move / insert-below / delete).
//   - Changes debounce-save through the saveReadingDoc server action.
//
// "Read as the student" renders the live doc through the student
// DocRenderer — the same component /lesson uses — so preview cannot
// diverge from what students actually see.
//
// Provenance discipline enforced here:
//   - NO command converts a human paragraph into an AI segment. AI
//     segments only enter via the aiPrompt widget, which goes through
//     /api/teacher/generate-segment (server-attached generation
//     metadata). The teacher cannot forge a generation stamp.
//   - NO "rewrite with AI" / "polish" / "continue writing" anywhere.
//     The teacher's words are the teacher's words.

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { saveReadingDoc } from "@/app/actions/teacher";
import { tokens } from "@/lib/design/tokens";
import DocRenderer from "@/components/lesson/DocRenderer";
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
import { SegmentSpine } from "./reading-editor/SegmentSpine";
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
type Mode = "compose" | "student";

const SLASH_TO_SUBKIND: Partial<Record<SlashItem["kind"], PromptSubKind>> = {
  ai_paragraph: "paragraph",
  ai_chart: "chart",
  ai_diagram: "diagram",
};

// Insert the transient AI prompt widget at the current selection. If the
// caret sits in an empty plain paragraph, the widget replaces it;
// otherwise it lands after the current top-level block, never splitting
// the teacher's prose.
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

const SAVE_LABEL: Record<string, { text: string; color: string }> = {
  idle: { text: "autosaves", color: "" },
  saving: { text: "saving…", color: "" },
  saved: { text: "saved", color: "" },
  error: { text: "save failed", color: "" },
};

export function ReadingDocEditor({
  lessonId,
  blockId,
  lessonTitle,
  lessonPrompt,
  initialDoc,
}: Props) {
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [mode, setMode] = useState<Mode>("compose");
  const [previewDoc, setPreviewDoc] = useState<Doc>(initialDoc);
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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
  // while the page scrolls.
  useEffect(() => {
    if (!editor) return;
    function onScroll(): void {
      if (slashRef.current && editor) syncSlash(editor);
    }
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [editor, syncSlash]);

  function enterStudentView(): void {
    if (editor) setPreviewDoc(editorJsonToDoc(editor.getJSON()));
    setMode("student");
    setSlash(null);
  }

  const modeTab = (label: string, target: Mode, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: mode === target ? tokens.color.text : tokens.color.faint,
        padding: "4px 10px",
        border: "none",
        borderBottom: `2px solid ${
          mode === target ? tokens.color.text : "transparent"
        }`,
        background: "transparent",
        fontFamily: tokens.font.ui,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  const save = SAVE_LABEL[saveStatus];
  const saveDotColor =
    saveStatus === "error"
      ? tokens.color.flagBd
      : saveStatus === "saved"
        ? tokens.ai.border
        : tokens.color.border;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 32,
        padding: "26px 28px 80px",
      }}
    >
      {/* The spine — structural map + composition ledger */}
      {editor && (
        <SegmentSpine
          editor={editor}
          interactive={mode === "compose"}
          onInsertAI={() => {
            editor.commands.focus();
            insertPromptWidget(editor, "paragraph");
          }}
        />
      )}

      {/* The manuscript column */}
      <div style={{ width: "min(720px, 100%)", minWidth: 0 }}>
        {/* Epigraph — the question this reading serves */}
        <div style={{ margin: "0 0 18px", padding: "0 8px" }}>
          <div
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: tokens.color.faint,
              marginBottom: 6,
            }}
          >
            The question this reading serves
          </div>
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 15,
              fontStyle: "italic",
              lineHeight: 1.6,
              color: tokens.color.sec,
              maxWidth: "62ch",
            }}
          >
            {lessonPrompt}
          </div>
        </div>

        {/* Mode tabs + save state */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            marginBottom: 10,
          }}
        >
          {modeTab("Compose", "compose", () => setMode("compose"))}
          {modeTab("As the student", "student", enterStudentView)}
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: tokens.font.ui,
              fontSize: 9,
              color:
                saveStatus === "error"
                  ? tokens.color.flagText
                  : tokens.color.faint,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: saveDotColor,
                display: "inline-block",
              }}
            />
            {save.text}
          </span>
        </div>

        {/* The sheet */}
        <div
          style={{
            background: tokens.color.cardLight,
            borderRadius: 4,
            boxShadow: tokens.shadowMd,
            border: `1px solid ${tokens.color.border}`,
            padding:
              mode === "compose" ? "44px 52px 56px 30px" : "44px 52px 56px",
          }}
        >
          {mode === "compose" ? (
            <div
              ref={wrapperRef}
              style={{
                position: "relative",
                paddingLeft: 24, // gutter for the ⋮⋮ block handle
              }}
            >
              {editor && (
                <BlockHandle editor={editor} wrapperRef={wrapperRef} />
              )}
              <EditorContent
                editor={editor}
                style={{
                  fontFamily: tokens.font.body,
                  fontSize: 17,
                  lineHeight: 1.85,
                  color: tokens.color.text,
                }}
              />
            </div>
          ) : (
            <div data-student-preview="true">
              <DocRenderer doc={previewDoc} />
            </div>
          )}
        </div>

        {mode === "student" && (
          <div
            style={{
              marginTop: 10,
              padding: "0 8px",
              fontFamily: tokens.font.ui,
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: tokens.color.faint,
            }}
          >
            Rendered exactly as the student&apos;s lesson page renders it.
          </div>
        )}
      </div>

      {slash && mode === "compose" && (
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
