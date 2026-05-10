import { tokens } from "@/lib/design/tokens";

/**
 * Column label. Syne uppercase 8px, weight 600, letter-spacing 0.14em.
 * Used in the student's main column for labels like "Your response",
 * "October 12", or "◆ Question" (the only AI-marked label that legitimately
 * lives in the student column, because the question is the prompt the
 * student is responding to).
 *
 * Sibling of MLabel; same family, slightly looser tracking and slightly
 * larger bottom margin to read at the wider main-column rhythm.
 */
export default function ColLabel({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}
