import Link from "next/link";
import { tokens } from "@/lib/design/tokens";

// 52px left rail. Position-based active state: a 2px right-side border
// against the inactive 30% opacity of the surrounding items. No fill, no
// color, no glyph library. Active item is identified by being where the
// teacher already is, not by a chip pinned to it.
//
// The rail is configurable so a future student-side rail can reuse it
// with different items. Glyphs are unicode geometric shapes — never icon
// fonts (those drift across platforms and don't fit the typographic
// discipline) and never emoji (color and platform variance).

export type NavItem = {
  key: string;
  label: string;
  glyph: string;
  href: string;
};

export default function NavRail({
  items,
  active,
}: {
  items: NavItem[];
  // Optional: when omitted, no item is highlighted. The rail still renders
  // — useful on transitional surfaces (e.g. /signup) where the user is not
  // yet inside a logged-in destination.
  active?: string;
}) {
  return (
    <nav
      aria-label="Primary navigation"
      style={{
        width: 52,
        flexShrink: 0,
        background: tokens.color.margin,
        borderRight: `1px solid ${tokens.color.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 14,
        paddingBottom: 16,
        gap: 2,
      }}
    >
      <Link
        href="/teacher"
        aria-label="Paideia"
        style={{
          fontSize: 16,
          fontWeight: 400,
          color: tokens.color.text,
          fontFamily: tokens.font.body,
          fontStyle: "italic",
          marginBottom: 18,
          textDecoration: "none",
          lineHeight: 1,
        }}
      >
        P
      </Link>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            style={{
              width: "100%",
              padding: "10px 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              textDecoration: "none",
              borderRight: isActive
                ? `2px solid ${tokens.color.text}`
                : "2px solid transparent",
              opacity: isActive ? 1 : 0.3,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                fontSize: 13,
                color: tokens.color.text,
                fontFamily: tokens.font.body,
                lineHeight: 1,
              }}
            >
              {item.glyph}
            </span>
            <span
              style={{
                fontSize: 6.5,
                fontWeight: 700,
                color: tokens.color.text,
                fontFamily: tokens.font.ui,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

