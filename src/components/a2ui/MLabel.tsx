import { tokens } from "@/lib/design/tokens";

/**
 * Margin label. Syne uppercase 8px, weight 600, letter-spacing 0.18em.
 * Used inside MarginPanel for AI surfacings — typically prefixed with the
 * "◆" marker by the caller, e.g. <MLabel>◆ Context</MLabel>.
 *
 * Keep separate from ColLabel: margin labels run tighter (0.18em) and live
 * against the slightly darker margin tone; column labels run looser (0.14em)
 * and live in the student's main column. The two contexts are visually
 * distinguished structurally, not chromatically.
 */
export default function MLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 8,
        fontWeight: 600,
        color: tokens.color.ter,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        marginBottom: 7,
        fontFamily: tokens.font.ui,
      }}
    >
      {children}
    </div>
  );
}
