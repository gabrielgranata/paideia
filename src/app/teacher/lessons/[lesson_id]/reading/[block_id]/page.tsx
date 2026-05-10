// Reading block editor — /teacher/lessons/[lesson_id]/reading/[block_id]
//
// Dedicated route for editing one long-form reading block. The lesson
// composer page (`/teacher/lessons/[lesson_id]/edit`) links here from
// each reading block; the full-page editor avoids cramming a rich-text
// surface into the composer's vertical timeline.
//
// Server-side: auth, load the lesson + block, pass the initial Doc to
// the client editor. The editor owns its own state and debounced-save
// flow against saveReadingDoc.

import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { ReadingDocEditor } from "@/components/teacher/ReadingDocEditor";
import {
  type Doc,
  parseOrMigrateBlocks,
} from "@/lib/lesson-blocks";

type LessonRow = {
  id: string;
  title: string;
  prompt: string;
  blocks: unknown;
};

export default async function Page({
  params,
}: {
  params: Promise<{ lesson_id: string; block_id: string }>;
}) {
  await requireRole("teacher");
  const { lesson_id, block_id } = await params;

  const rows = (await sql`
    select id, title, prompt, blocks
    from lessons
    where id = ${lesson_id}
  `) as unknown as LessonRow[];
  const lesson = rows[0];
  if (!lesson) notFound();

  const blocks = parseOrMigrateBlocks(lesson.blocks);
  const target = blocks.find((b) => b.id === block_id);
  if (!target) notFound();
  if (target.type !== "reading") notFound();

  const initialDoc: Doc = target.content;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: tokens.color.canvas,
      }}
    >
      <Chrome
        title="Reading"
        subtitle={`${lesson.title} · ${target.meta ?? "long-form reading"}`}
        backHref={`/teacher/lessons/${lesson_id}/edit`}
        backLabel="Composer"
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          padding: "18px 20px",
          gap: 16,
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: 5,
            overflow: "hidden",
            boxShadow: tokens.shadow,
            background: tokens.color.panel,
          }}
        >
          <ReadingDocEditor
            lessonId={lesson_id}
            blockId={block_id}
            lessonTitle={lesson.title}
            lessonPrompt={lesson.prompt}
            initialDoc={initialDoc}
          />

          <div
            style={{
              padding: "10px 18px",
              borderTop: `1px solid ${tokens.color.border}`,
              background: tokens.color.margin,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: tokens.font.ui,
              fontSize: 10,
              color: tokens.color.ter,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span>Edits save automatically after a brief pause.</span>
            <Link
              href={`/teacher/lessons/${lesson_id}/edit`}
              style={{
                fontWeight: 700,
                color: tokens.color.text,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              ← Back to composer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
