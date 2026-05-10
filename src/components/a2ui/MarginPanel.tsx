import { tokens } from "@/lib/design/tokens";

type Props = {
  width?: number;
  children: React.ReactNode;
};

/**
 * The AI margin. Direction E identifies AI by *position* — left margin,
 * slightly darker cream — not by color or icon. AI surfacings (Context,
 * Question header from the system, Think-out-loud, Arc readings) live here.
 *
 * Boundary discipline: never put student-authored content inside MarginPanel.
 * The mirror discipline lives in MainColumn — the student's column never
 * contains AI-generated prose, with the single exception of QuestionPrompt
 * (which is the prompt the student is responding to, not AI commentary).
 *
 * Width default 196 matches the wireframe; configurable for narrower or
 * wider AI columns (e.g. 230 for the right-side think-out-loud panel in
 * the teacher reader).
 */
export default function MarginPanel({ width = 196, children }: Props) {
  return (
    <div
      style={{
        width,
        background: tokens.color.margin,
        borderRight: `1px solid ${tokens.color.border}`,
        padding: "28px 18px 20px 24px",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
