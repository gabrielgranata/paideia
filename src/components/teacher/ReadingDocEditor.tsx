"use client";

// ReadingDocEditor — TipTap-based editor for one reading block.
//
// Architecture:
//   - StarterKit handles paragraph / bold / italic / etc. The default
//     `paragraph` node serves as a human-authored segment.
//   - Three custom block nodes (aiParagraph, aiChart, aiDiagram) represent
//     AI-authored segments. The Segment data lives on the node's `segment`
//     attr; NodeViews render the provenance UI inline.
//   - On every change, the editor serializes its JSON to a Doc and
//     debounce-saves via the saveReadingDoc server action. No optimistic
//     UI beyond the editor's own local state; the server is the canonical
//     persistence.
//
// Provenance discipline enforced here:
//   - There is NO command to convert a human paragraph into an AI segment.
//     AI segments only enter via the GeneratePanel, which goes through
//     /api/teacher/generate-segment (which server-attaches generation
//     metadata). The teacher cannot forge a generation stamp from inside
//     the editor.
//   - There is NO "rewrite with AI" command for existing human prose.
//     The teacher's words are the teacher's words.

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { saveReadingDoc } from "@/app/actions/teacher";
import { tokens } from "@/lib/design/tokens";
import {
  AIParagraphExtension,
  AIChartExtension,
  AIDiagramExtension,
} from "./reading-editor/extensions";
import {
  docToEditorContent,
  editorJsonToDoc,
} from "./reading-editor/serialize";
import { GeneratePanel } from "./reading-editor/GeneratePanel";
import type { Doc, Segment } from "@/lib/lesson-blocks";

const SAVE_DEBOUNCE_MS = 700;

type Props = {
  lessonId: string;
  blockId: string;
  lessonTitle: string;
  lessonPrompt: string;
  initialDoc: Doc;
};

export function ReadingDocEditor({
  lessonId,
  blockId,
  lessonTitle,
  lessonPrompt,
  initialDoc,
}: Props) {
  const [generateOpen, setGenerateOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          "Write the reading. Use the ◆ button to insert an AI-generated paragraph, chart, or diagram.",
      }),
      AIParagraphExtension,
      AIChartExtension,
      AIDiagramExtension,
    ],
    content: docToEditorContent(initialDoc) as unknown as Record<string, unknown>,
    immediatelyRender: false, // Next.js SSR compatibility
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

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Pull a snippet of surrounding text for the composer. Used as the
  // surrounding_text input — gives the LLM enough context to write a
  // segment that fits the existing prose.
  const getSurroundingText = useCallback((): string => {
    if (!editor) return "";
    const full = editor.getText();
    // Take ~600 characters around the current selection, or the whole
    // doc if it's short.
    if (full.length <= 600) return full;
    const pos = editor.state.selection.from;
    const start = Math.max(0, pos - 300);
    const end = Math.min(full.length, pos + 300);
    return editor.state.doc.textBetween(start, end, " ");
  }, [editor]);

  const insertSegment = useCallback(
    (segment: Segment) => {
      if (!editor) return;
      if (segment.kind === "human") {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "paragraph",
            attrs: { id: segment.id },
            content: segment.body
              ? [{ type: "text", text: segment.body }]
              : undefined,
          })
          .run();
        return;
      }
      if (segment.sub_kind === "paragraph") {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "aiParagraph",
            attrs: { id: segment.id, segment },
            content: segment.body
              ? [{ type: "text", text: segment.body }]
              : undefined,
          })
          .run();
        return;
      }
      if (segment.sub_kind === "chart") {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "aiChart",
            attrs: { id: segment.id, segment },
          })
          .run();
        return;
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: "aiDiagram",
          attrs: { id: segment.id, segment },
        })
        .run();
    },
    [editor],
  );

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
          onClick={() => setGenerateOpen((v) => !v)}
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
          {tokens.aiMarker} {generateOpen ? "Close generator" : "Insert AI segment"}
        </button>

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

      {/* Body — generate panel + editor surface */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 36px",
          background: tokens.color.panel,
        }}
      >
        {generateOpen && (
          <GeneratePanel
            lessonId={lessonId}
            blockId={blockId}
            lessonTitle={lessonTitle}
            lessonPrompt={lessonPrompt}
            getSurroundingText={getSurroundingText}
            onGenerated={(seg) => insertSegment(seg)}
            onClose={() => setGenerateOpen(false)}
          />
        )}
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
  );
}
