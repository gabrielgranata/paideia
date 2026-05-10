import Link from "next/link";
import { tokens } from "@/lib/design/tokens";
import type { ArtifactCardProps } from "@/lib/a2ui/spec";

/**
 * Cream card. 1px border, 5px radius. The card hierarchy:
 *  - Type chip (top): Syne uppercase 9px tertiary
 *  - Title: DM Serif Display italic 15px primary
 *  - Meta (blurb / context): EB Garamond 11px tertiary
 *  - Status pill (bottom): Syne uppercase 9px in a margin-toned pill
 *
 * Hover darkens the border without introducing a color signal — same warm
 * tone, lower opacity. The card is navigation, not generation: the link
 * goes to the artifact page where the substrate-anchored content lives.
 */
export default function ArtifactCard({
  artifact_id,
  title,
  type,
  blurb,
}: ArtifactCardProps) {
  return (
    <Link
      href={`/artifacts/${artifact_id}`}
      // Tailwind hover lives on the className so it can override the inline
      // border without us shipping a stylesheet. Hover darkens the border to
      // #1A1610 at 40% — same warm tone, just denser. No color signal.
      className="group block border border-[#CFC8B4] hover:border-[#1A1610]/40 transition-colors duration-150"
      style={{
        borderRadius: 5,
        background: tokens.color.card,
        padding: "18px 20px",
        boxShadow: tokens.shadow,
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.ter,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          marginBottom: 10,
          fontFamily: tokens.font.ui,
        }}
      >
        {type}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 400,
          fontStyle: "italic",
          color: tokens.color.text,
          marginBottom: 6,
          fontFamily: tokens.font.display,
          lineHeight: 1.3,
        }}
      >
        {title}
      </div>
      <p
        style={{
          fontSize: 11,
          color: tokens.color.ter,
          marginBottom: 14,
          fontFamily: tokens.font.body,
          lineHeight: 1.55,
          flex: 1,
        }}
      >
        {blurb}
      </p>
      <span
        style={{
          alignSelf: "flex-start",
          fontSize: 9,
          fontWeight: 600,
          padding: "2px 9px",
          borderRadius: 10,
          background: tokens.color.margin,
          color: tokens.color.ter,
          fontFamily: tokens.font.ui,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
        }}
      >
        Open
      </span>
    </Link>
  );
}
