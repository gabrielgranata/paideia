import Link from "next/link";
import { tokens } from "@/lib/design/tokens";
import UserMenu from "@/components/nav/UserMenu";
import type { Role } from "@/lib/auth";

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  // CTAs only — e.g. "+ New Lesson". Do NOT render navigation links here;
  // those duplicate the NavRail. Identity / sign-out belongs in the
  // far-right UserMenu, populated via the `user` prop.
  children?: React.ReactNode;
  // Optional left-side back affordance. Renders "← Back" before the
  // wordmark (matches the wireframe TopBar pattern). If you need a
  // custom label, pass `backLabel`.
  backHref?: string;
  backLabel?: string;
  // Identity for the right-hand UserMenu. Omit on unauthenticated pages
  // (login, signup) and on pure-demo routes that have no logged-in user.
  user?: { name: string; email: string; role: Role };
};

/**
 * Top bar. Recessive by design — same cream as canvas, distinguished only by
 * a 1px bottom hairline. Houses the wordmark, a vertical divider, the page
 * title in Syne uppercase, an optional subtitle, an optional flexible-right
 * slot, and an optional children slot for inline actions.
 *
 * The chrome is the equipment of the system, not its content. Background
 * matches canvas so the page reads as a continuous surface.
 */
export default function Chrome({
  title,
  subtitle,
  right,
  children,
  backHref,
  backLabel = "Back",
  user,
}: Props) {
  return (
    <div
      style={{
        padding: "12px 40px",
        background: tokens.color.chrome,
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexShrink: 0,
        borderBottom: `1px solid ${tokens.color.border}`,
      }}
    >
      {backHref && (
        <Link
          href={backHref}
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 10,
            fontWeight: 600,
            color: tokens.color.ter,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← {backLabel}
        </Link>
      )}
      <span
        style={{
          fontSize: 17,
          fontWeight: 500,
          color: tokens.color.text,
          fontFamily: tokens.font.body,
          letterSpacing: "0.01em",
        }}
      >
        Paideia
      </span>
      <div
        style={{
          width: 1,
          height: 14,
          background: tokens.color.border,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 10,
          color: tokens.color.ter,
          fontFamily: tokens.font.ui,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </span>
      {subtitle && (
        <span
          style={{
            fontSize: 10,
            color: tokens.color.ter,
            fontFamily: tokens.font.ui,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          · {subtitle}
        </span>
      )}
      <div style={{ flex: 1 }} />
      {children}
      {right && (
        <span
          style={{
            fontSize: 10,
            color: tokens.color.ter,
            fontFamily: tokens.font.ui,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {right}
        </span>
      )}
      {user && <UserMenu user={user} />}
    </div>
  );
}
