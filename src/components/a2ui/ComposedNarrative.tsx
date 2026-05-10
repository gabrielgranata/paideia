import { tokens } from "@/lib/design/tokens";
import type { ComposedNarrativeProps } from "@/lib/a2ui/spec";

/**
 * Continuous prose. Each cited sentence ends with a small superscript
 * carrying the citation count; the `title` attribute exposes the node IDs
 * for hover inspection. Empty `cites` is meta-prose (e.g. headings like
 * "Your argument so far:") — rendered italic at lower opacity, with no
 * superscript. Uncited prose is the drift signal we are trying to detect:
 * it must be visually distinguishable from cited prose at a glance.
 *
 * Direction E: EB Garamond at 16px, line-height 1.9. The body of an
 * AI-composed narrative is italic only when it is meta-prose (commentary
 * by the system about its own composition); cited content reads as the
 * argument it summarizes, in the same body weight as student writing,
 * because the citations — not typography — mark its provenance.
 */
export default function ComposedNarrative({ sentences }: ComposedNarrativeProps) {
  return (
    <p
      style={{
        fontFamily: tokens.font.body,
        fontSize: 16,
        lineHeight: 1.9,
        color: tokens.color.text,
        margin: 0,
        whiteSpace: "pre-wrap",
      }}
    >
      {sentences.map((s, i) => {
        const isMeta = s.cites.length === 0;
        const sep = i === sentences.length - 1 ? "" : " ";
        if (isMeta) {
          return (
            <span
              key={i}
              style={{
                opacity: 0.55,
                fontStyle: "italic",
                color: tokens.color.sec,
              }}
            >
              {s.text}
              {sep}
            </span>
          );
        }
        return (
          <span key={i}>
            {s.text}
            <sup
              title={s.cites.join(", ")}
              style={{
                marginLeft: 2,
                fontSize: 10,
                fontFamily: tokens.font.ui,
                color: tokens.color.ter,
                cursor: "help",
                userSelect: "none",
                letterSpacing: "0.04em",
              }}
            >
              [{s.cites.length}]
            </sup>
            {sep}
          </span>
        );
      })}
    </p>
  );
}
