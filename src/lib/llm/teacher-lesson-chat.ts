// teacher-lesson-chat — the 7th bounded LLM call in the system.
//
// Scope, named explicitly to prevent drift:
//
//   The teacher's authoring-time conversation about ONE lesson. Reads the
//   lesson title, prompt, and current block contents (flattened to text)
//   plus prior messages in this teacher × lesson thread. Output is a
//   reply string + an optional structured suggested_action the teacher
//   can click to apply.
//
//   This call NEVER reads from substrate (sessions/turns/nodes/edges).
//   NEVER writes to substrate. NEVER appears on a student route. The
//   surface is teacher-only and the API route enforces the role check.
//
// Why a 7th call rather than reusing lesson-content-composer: chat is
// multi-turn (prior messages condition the next reply), whereas
// lesson-content-composer is one-shot (no history). They have different
// invariants. Bundling them into one function would force the composer
// to accept a possibly-empty history and would muddy the audit trail.
//
// Pipeline-not-agent discipline preserved: the conversation history is
// retrieval, not source of truth. Lesson context is rebuilt fresh from
// Postgres every turn. The LLM does not autonomously decide to mutate
// anything — every state change is initiated by the teacher clicking
// either "Send" or a "suggested_action" affordance.
//
// Output discipline: the only free-form completion field is `reply`
// (the chat reply itself MUST be prose; there is no structured way to
// say that). `suggested_action` is a closed discriminated union — the
// LLM cannot invent new action kinds. The teacher must explicitly
// accept any action; the LLM never writes a block directly.

import { z } from "zod";
import { structuredCall } from "./anthropic";

// ── Output schema ────────────────────────────────────────────────────

// Closed enum for the actions the LLM can propose. Each action carries
// the content the teacher would be agreeing to insert. Discriminator is
// `kind` — adding a new action kind is an architecture decision (new
// renderer affordance, new apply-action path).
export const ChatSuggestedActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("insert_ai_generated"),
    content: z.string().min(1),
  }),
  z.object({
    kind: z.literal("insert_context"),
    content: z.string().min(1),
  }),
  z.object({
    kind: z.literal("insert_prompt"),
    content: z.string().min(1),
  }),
]);
export type ChatSuggestedAction = z.infer<typeof ChatSuggestedActionSchema>;

export const ChatOutputSchema = z.object({
  reply: z.string().min(1).describe(
    "Your reply to the teacher. Address what they asked. Keep it short — a paragraph or two unless they explicitly asked for length. Voice is observational and structural, never declarative about what the lesson should conclude.",
  ),
  suggested_action: ChatSuggestedActionSchema.optional().describe(
    "If your reply proposes specific text the teacher could insert into the lesson, emit it here as a structured action. The teacher clicks to accept. Do not include the same text inside `reply` if you put it in `suggested_action` — let the action's affordance carry it.",
  ),
});
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

// ── Input shape (TS, not Zod — built server-side) ───────────────────

// The persistence shape — includes id (for targeting one message in
// applyChatSuggestedAction) and action_applied (lifecycle for assistant
// messages that carried a suggested_action: once accepted it's marked
// applied=true so the affordance can't fire twice).
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggested_action?: ChatSuggestedAction;
  action_applied?: boolean;
  created_at: string;
};

export type ChatInput = {
  lesson_title: string;
  lesson_prompt: string;
  /** Flattened block contents in lesson order. Each entry is `[type] text`. */
  lesson_blocks_flat: string;
  history: ChatMessage[];
  user_message: string;
};

// ── System prompt ────────────────────────────────────────────────────

const SYSTEM = `You are a component of Paideia, a learning platform built on the premise that the activity of reasoning is what learning consists of.

This specific surface is the teacher's authoring-time assistant for ONE lesson. You see the lesson title, prompt, and current block contents. You help the teacher think through what's in the lesson, what might be missing, and what they might add. You are NOT in the student loop and you are NOT writing on a student's behalf.

What you may do
- Discuss the lesson's structure, source material, and the question the student is being asked.
- Surface gaps the teacher might consider: a counter-position absent, a primary source untouched, a perspective that would sharpen the question.
- Propose specific text the teacher could insert — when you do, emit it as a structured suggested_action (insert_ai_generated, insert_context, or insert_prompt). The teacher clicks to accept; you do NOT insert directly.

What you NEVER do
- You NEVER state or imply what conclusion the student should reach. The lesson's central question is for the STUDENT to reason through. Your job is to help the teacher build the question, not to answer it.
- You NEVER smooth conflicts in source material into a balanced "both sides" summary. If you propose a counter-position block, propose it as a perspective the student should engage, not a position to balance against.
- You NEVER produce "5 key takeaways" or similar instructional shortcuts. Source material is reasoned against, not memorized.
- You NEVER rewrite the teacher's existing prose. The teacher's words are theirs. You can propose new content; you cannot transform existing content.

Voice
- Observational, specific, anchored in the lesson context the teacher gave you.
- Replies are short — usually a paragraph. The teacher reads carefully; padding wastes their attention.
- No "let me know if you'd like me to," no "I'd be happy to," no "great question." Direct.

Suggested actions
- Only emit suggested_action when you have specific, ready-to-insert text. Do not propose vague "you could add a paragraph about X" — either provide the paragraph as an action or just discuss the gap in your reply.
- insert_ai_generated: a standalone AI-authored teaching block (visible to student with ◆ marker).
- insert_context: framing prose for the lesson's left margin (teacher-authored framing in the spatial logic).
- insert_prompt: a revised lesson question. The teacher will likely have only one prompt block, so this typically replaces.
- If your reply has a suggested_action, the action's content carries the text — do not duplicate it inside the reply.`;

// ── The call ─────────────────────────────────────────────────────────

function renderHistory(history: ChatMessage[]): string {
  // Most-recent-last so the user message we're responding to follows in
  // chronological order. Capped at 20 turns — past that, prior context
  // probably matters less than current state.
  const recent = history.slice(-20);
  return recent
    .map((m) => {
      const tag = m.role === "user" ? "Teacher" : "You";
      const action = m.suggested_action
        ? `\n[you proposed action: ${m.suggested_action.kind}]`
        : "";
      return `${tag}: ${m.content}${action}`;
    })
    .join("\n\n");
}

export async function runTeacherLessonChat(input: ChatInput): Promise<ChatOutput> {
  const userMessage = `LESSON CONTEXT (rebuilt fresh from substrate every turn):

Title: ${input.lesson_title}
Central question: ${input.lesson_prompt}

Current blocks (in order):
${input.lesson_blocks_flat || "[no blocks yet]"}

CONVERSATION SO FAR:
${input.history.length === 0 ? "[first message]" : renderHistory(input.history)}

NEW TEACHER MESSAGE:
${input.user_message}`;

  return structuredCall({
    system: SYSTEM,
    user: userMessage,
    schema: ChatOutputSchema,
    schemaName: "emit_chat_reply",
    schemaDescription:
      "Emit your reply to the teacher, with an optional structured suggested_action if you're proposing specific text they could insert.",
    maxTokens: 1500,
  });
}
