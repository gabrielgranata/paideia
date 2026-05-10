import { tokens } from "@/lib/design/tokens";
import type { QuestionPromptProps } from "@/lib/a2ui/spec";

/**
 * The system's structural observation surfaced as an inquiry back to the
 * student. Not a chat reply. Not "AI says…". Not a completion affordance.
 *
 * Direction E: the question stands by typography alone. DM Serif Display
 * italic at 26px carries the question itself; a Syne uppercase "◆ Question"
 * mini-label sits above it; a 1px hairline below it acts as the only
 * divider. No left border, no colored panel, no accent. The original
 * Direction E spec removes the colored accent; the question is load-bearing
 * because it is the question, not because it is decorated.
 *
 * `target_node_ids` and `gap_type` are intentionally NOT rendered visually
 * — they are exposed to the renderer for trace/anchoring purposes (teacher
 * drill-down, future linking) but the student-facing surface stays quiet.
 */
export default function QuestionPrompt({
  question,
  target_node_ids,
  gap_type,
}: QuestionPromptProps) {
  return (
    <section
      aria-label="Question from the system"
      data-target-node-ids={target_node_ids.join(",")}
      data-gap-type={gap_type}
      style={{ marginBottom: 0 }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 600,
          color: tokens.color.ter,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 10,
          fontFamily: tokens.font.ui,
        }}
      >
        {tokens.aiMarker} Question
      </div>
      <p
        style={{
          fontFamily: tokens.font.display,
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: 26,
          lineHeight: 1.36,
          color: tokens.color.text,
          margin: "0 0 26px",
        }}
      >
        {question}
      </p>
      <div
        style={{
          height: 1,
          background: tokens.color.border,
        }}
      />
    </section>
  );
}
