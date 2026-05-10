import { tokens } from "@/lib/design/tokens";

type Props = {
  children: React.ReactNode;
};

/**
 * Student writing surface. The page is the student's by default — no
 * marker, no chip, no bracket. Cream against the slightly darker margin
 * tone of MarginPanel; the contrast is structural, not chromatic.
 *
 * BOUNDARY DISCIPLINE
 * -------------------
 * NO AI element should ever be a direct child of MainColumn, with one
 * exception: QuestionPrompt. The question is the prompt the student is
 * responding to — it lives at the head of the writing surface because
 * answering it IS the writing. Every other AI surfacing (Context,
 * Think-out-loud, Arc, Sources, ComposedNarrative) belongs in MarginPanel.
 *
 * If you find yourself wanting to drop AI-composed prose into MainColumn,
 * the design has drifted: re-read the recede test in
 * /paideia-fidelity-check before adding it.
 */
export default function MainColumn({ children }: Props) {
  return (
    <div
      style={{
        flex: 1,
        background: tokens.color.card,
        padding: "36px 60px 36px 50px",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}
