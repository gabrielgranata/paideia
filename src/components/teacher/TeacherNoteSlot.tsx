"use client";

// TeacherNoteSlot — the per-block private-note affordance.
//
// Before: every block carried a dashed teacher-note container by default,
// inflating the visual weight of every row whether or not the teacher
// had anything to write.
//
// Now: if the block already has a saved note, the form renders as before
// (the note IS load-bearing and the teacher needs to see/edit it). If
// there's no note, render only a faint "+ Add private note" link that
// reveals the form on click. The form is the same; only its surfacing
// changed. After save, the note becomes load-bearing and stays visible
// on subsequent loads.
//
// Why a client component for this small toggle: the surrounding Block
// is a server component, and the toggle needs local UI state. The
// form's submit still flows through the saveTeacherNote server action.

import { useState } from "react";
import { tokens } from "@/lib/design/tokens";
import { saveTeacherNote } from "@/app/actions/teacher";

type Props = {
  lessonId: string;
  blockId: string;
  teacherNote?: string;
};

export function TeacherNoteSlot({ lessonId, blockId, teacherNote }: Props) {
  const hasNote = (teacherNote ?? "").trim().length > 0;
  const [open, setOpen] = useState(hasNote);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          alignSelf: "flex-start",
          marginTop: 2,
          padding: "2px 0",
          background: "transparent",
          border: "none",
          fontFamily: tokens.font.ui,
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.faint,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        + Add private note
      </button>
    );
  }

  return (
    <div
      style={{
        padding: "10px 14px",
        border: `1px dashed ${tokens.color.border}`,
        background: tokens.color.cardLight,
        borderRadius: 3,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: tokens.color.faint,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: tokens.font.ui,
          }}
        >
          Teacher note — private
        </span>
        {!hasNote && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: tokens.font.ui,
              fontSize: 9,
              color: tokens.color.faint,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>
      <form action={saveTeacherNote}>
        <input type="hidden" name="lessonId" value={lessonId} />
        <input type="hidden" name="blockId" value={blockId} />
        <textarea
          name="note"
          defaultValue={teacherNote ?? ""}
          rows={2}
          placeholder="Add a private note — not visible to student"
          autoFocus={!hasNote}
          style={{
            width: "100%",
            padding: "4px 0",
            fontSize: 12,
            lineHeight: 1.65,
            color: tokens.color.sec,
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: tokens.font.body,
            fontStyle: "italic",
            resize: "vertical",
          }}
        />
        <div
          style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}
        >
          <button
            type="submit"
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: tokens.color.faint,
              background: "transparent",
              border: "none",
              fontFamily: tokens.font.ui,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              padding: "2px 0",
            }}
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
