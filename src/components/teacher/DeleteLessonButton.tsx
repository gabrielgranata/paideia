"use client";

// Delete-lesson affordance — small client wrapper so we can intercept
// the form submit with a native confirm() prompt. The action itself
// stays a server action; the client only handles the confirmation
// gate. On accept the action redirects, so this component never
// renders a post-delete state.

import { deleteLesson } from "@/app/actions/teacher";
import { tokens } from "@/lib/design/tokens";

type Props = {
  lessonId: string;
  lessonTitle: string;
};

export function DeleteLessonButton({ lessonId, lessonTitle }: Props) {
  return (
    <form
      action={deleteLesson}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Delete "${lessonTitle}"?\n\nThis removes the lesson, every student's reading and session for it, and the lesson-chat thread. This can't be undone.`,
        );
        if (!ok) e.preventDefault();
      }}
      style={{ display: "inline" }}
    >
      <input type="hidden" name="lessonId" value={lessonId} />
      <button
        type="submit"
        title="Delete this lesson and all sessions / readings anchored to it"
        style={{
          fontSize: 10,
          color: tokens.color.ter,
          padding: "5px 14px",
          border: `1px solid ${tokens.color.border}`,
          background: "transparent",
          fontFamily: tokens.font.ui,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer",
          borderRadius: 2,
        }}
      >
        ✕ Delete lesson
      </button>
    </form>
  );
}
