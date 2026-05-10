"use client";

// ChatPanel — the teacher's authoring-time AI surface for ONE lesson.
//
// Lives in the right side of the lesson edit page. Dismissible (collapsed
// state shows a slim affordance to reopen). Holds the conversation thread
// passed in from the server, optimistically appends the teacher's message
// on send, awaits the assistant reply via the sendChatMessage server
// action, then renders it. If the reply carries a suggested_action, the
// teacher sees a one-click affordance to apply it (creates a new block).
//
// Discipline:
//   - Teacher-only — the parent page gates with requireRole("teacher").
//     This component does NOT render auth state itself.
//   - No optimistic apply of suggested_action: the teacher clicks, the
//     server creates the block, the lesson page revalidates, the
//     "applied" mark renders on the next read. Authoring stays
//     teacher-as-author.
//   - The chat is peripheral — student writing is the foreground rule,
//     but this is a TEACHER surface, not a student one. Style is still
//     restrained (no chat bubbles with avatars; quiet typography).

import { useState, useTransition, useRef, useEffect } from "react";
import {
  sendChatMessage,
  applyChatSuggestedAction,
} from "@/app/actions/teacher";
import { tokens } from "@/lib/design/tokens";
import type {
  ChatMessage,
  ChatSuggestedAction,
} from "@/lib/llm/teacher-lesson-chat";

type Props = {
  lessonId: string;
  initialHistory: ChatMessage[];
  // The chat opens collapsed by default if there's no history; open if
  // there are messages so the teacher resumes where they left off.
  defaultOpen?: boolean;
};

export function ChatPanel({ lessonId, initialHistory, defaultOpen }: Props) {
  const [open, setOpen] = useState<boolean>(
    defaultOpen ?? initialHistory.length > 0,
  );
  const [history, setHistory] = useState<ChatMessage[]>(initialHistory);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Auto-scroll to the latest message whenever history grows.
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length]);

  function send(): void {
    setError(null);
    const text = draft.trim();
    if (text.length === 0 || pending) return;

    // Optimistic: show the user's message immediately. The actual
    // persisted message gets a server-generated id and overwrites the
    // optimistic one when the action returns.
    const optimisticUser: ChatMessage = {
      id: `cmsg_optimistic_${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setHistory((h) => [...h, optimisticUser]);
    setDraft("");

    startTransition(async () => {
      try {
        const result = await sendChatMessage(lessonId, text);
        // Replace optimistic user msg with canonical history from server.
        setHistory(result.history);
      } catch (err) {
        // Roll back the optimistic message.
        setHistory((h) => h.filter((m) => m.id !== optimisticUser.id));
        setError(String(err));
      }
    });
  }

  function applyAction(messageId: string): void {
    if (applyingId) return;
    setApplyingId(messageId);
    setError(null);
    startTransition(async () => {
      try {
        await applyChatSuggestedAction(lessonId, messageId);
        // Mark the action as applied locally — the server revalidates
        // the edit page so the new block lands in the list.
        setHistory((h) =>
          h.map((m) =>
            m.id === messageId ? { ...m, action_applied: true } : m,
          ),
        );
      } catch (err) {
        setError(String(err));
      } finally {
        setApplyingId(null);
      }
    });
  }

  if (!open) {
    return (
      <aside
        style={{
          width: 40,
          flexShrink: 0,
          background: tokens.color.margin,
          borderLeft: `1px solid ${tokens.color.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 0",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open lesson chat"
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: tokens.font.ui,
            fontSize: 10,
            fontWeight: 700,
            color: tokens.color.ter,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: 0,
          }}
        >
          {tokens.aiMarker} Lesson chat
          {history.length > 0 && (
            <span style={{ marginLeft: 8, color: tokens.color.faint }}>
              · {history.length}
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        background: tokens.color.margin,
        borderLeft: `1px solid ${tokens.color.border}`,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 14px",
          borderBottom: `1px solid ${tokens.color.border}`,
          background: tokens.color.cardLight,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 9,
            fontWeight: 700,
            color: tokens.color.text,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {tokens.aiMarker} Talk about this lesson
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Collapse lesson chat"
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: tokens.font.ui,
            fontSize: 10,
            color: tokens.color.ter,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: 0,
          }}
        >
          ✕
        </button>
      </header>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: 0,
        }}
      >
        {history.length === 0 ? (
          <p
            style={{
              fontFamily: tokens.font.body,
              fontSize: 12,
              fontStyle: "italic",
              color: tokens.color.ter,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Ask about this lesson — what&apos;s missing, what to add, what a
            counter-position would look like. Suggestions you accept are
            inserted as blocks; you stay the author.
          </p>
        ) : (
          history.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              onApply={() => applyAction(m.id)}
              applyingId={applyingId}
            />
          ))
        )}
        {pending && (
          <div
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 9,
              color: tokens.color.ter,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontStyle: "italic",
            }}
          >
            {tokens.aiMarker} thinking…
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "8px 14px",
            background: tokens.color.flagBg,
            color: tokens.color.flagText,
            fontFamily: tokens.font.body,
            fontSize: 11,
            borderTop: `1px solid ${tokens.color.flagBd}`,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          padding: "10px 14px",
          borderTop: `1px solid ${tokens.color.border}`,
          background: tokens.color.cardLight,
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about this lesson…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          style={{
            width: "100%",
            padding: "6px 8px",
            fontFamily: tokens.font.body,
            fontSize: 12,
            color: tokens.color.text,
            background: tokens.color.panel,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: 2,
            outline: "none",
            resize: "vertical",
            marginBottom: 6,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 8,
              color: tokens.color.faint,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            ⌘↵ to send
          </span>
          <button
            type="button"
            onClick={send}
            disabled={pending || draft.trim().length === 0}
            style={{
              fontSize: 9,
              fontWeight: 700,
              color:
                pending || draft.trim().length === 0
                  ? tokens.color.faint
                  : tokens.color.text,
              padding: "4px 12px",
              border: `1px solid ${tokens.color.text}`,
              background: tokens.color.panel,
              fontFamily: tokens.font.ui,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor:
                pending || draft.trim().length === 0 ? "default" : "pointer",
              borderRadius: 2,
              opacity: pending ? 0.6 : 1,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  );
}

function MessageBubble({
  message,
  onApply,
  applyingId,
}: {
  message: ChatMessage;
  onApply: () => void;
  applyingId: string | null;
}) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: 4,
      }}
    >
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 8,
          fontWeight: 700,
          color: tokens.color.faint,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {isUser ? "You" : `${tokens.aiMarker} Lesson chat`}
      </span>
      <div
        style={{
          maxWidth: "92%",
          padding: "8px 11px",
          borderRadius: 4,
          background: isUser ? tokens.color.panel : tokens.color.cardLight,
          border: `1px solid ${tokens.color.border}`,
          fontFamily: tokens.font.body,
          fontSize: 13,
          lineHeight: 1.55,
          color: isUser ? tokens.color.text : tokens.color.sec,
          fontStyle: isUser ? "normal" : "italic",
          whiteSpace: "pre-wrap",
        }}
      >
        {message.content}
      </div>
      {message.suggested_action && (
        <SuggestedActionAffordance
          action={message.suggested_action}
          applied={message.action_applied ?? false}
          onApply={onApply}
          applying={applyingId === message.id}
        />
      )}
    </div>
  );
}

function actionLabel(action: ChatSuggestedAction): string {
  switch (action.kind) {
    case "insert_ai_generated":
      return "Insert as AI-generated block";
    case "insert_context":
      return "Insert as Context";
    case "insert_prompt":
      return "Use as lesson question";
  }
}

function SuggestedActionAffordance({
  action,
  applied,
  onApply,
  applying,
}: {
  action: ChatSuggestedAction;
  applied: boolean;
  onApply: () => void;
  applying: boolean;
}) {
  return (
    <div
      style={{
        width: "92%",
        padding: "8px 11px",
        background: tokens.color.panelWarm,
        border: `1px dashed ${tokens.color.border}`,
        borderRadius: 3,
        fontFamily: tokens.font.body,
        fontSize: 12,
        lineHeight: 1.55,
        color: tokens.color.text,
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 8,
          fontWeight: 700,
          color: tokens.color.ter,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        Proposed block — accept to insert
      </div>
      <div
        style={{
          fontStyle: "italic",
          color: tokens.color.sec,
          marginBottom: 8,
          whiteSpace: "pre-wrap",
        }}
      >
        {action.content}
      </div>
      <button
        type="button"
        onClick={onApply}
        disabled={applied || applying}
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: applied ? tokens.color.faint : tokens.color.text,
          padding: "4px 10px",
          border: `1px solid ${applied ? tokens.color.border : tokens.color.text}`,
          background: applied ? "transparent" : tokens.color.panel,
          fontFamily: tokens.font.ui,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: applied || applying ? "default" : "pointer",
          borderRadius: 2,
        }}
      >
        {applied
          ? "✓ Applied"
          : applying
            ? "Applying…"
            : actionLabel(action)}
      </button>
    </div>
  );
}
