"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { tokens } from "@/lib/design/tokens";
import type { Role } from "@/lib/auth";

// Right-hand identity chip for Chrome. Replaces the previous pattern of
// stuffing 2–3 underlined uppercase Link children plus a SignOutPill into
// every page's top bar — those duplicated the NavRail and read as ugly.
//
// The chip carries name + a small caret. Click reveals a dropdown anchored
// below-right with the identity row (name, email, role) and a Sign out
// action. Closes on outside click, Escape, or route change (the component
// remounts when Chrome re-renders on the next page).

type Props = {
  user: { name: string; email: string; role: Role };
};

export default function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          background: open ? tokens.color.margin : "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          color: tokens.color.text,
          fontFamily: tokens.font.body,
          padding: "5px 10px",
          borderRadius: 4,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          lineHeight: 1,
        }}
      >
        <span>{user.name}</span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 9,
            color: tokens.color.ter,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 120ms",
            display: "inline-block",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 220,
            background: tokens.color.panel,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: 6,
            boxShadow: tokens.shadowMd,
            paddingTop: 12,
            paddingBottom: 4,
            zIndex: 50,
          }}
        >
          <div style={{ padding: "0 14px 10px 14px" }}>
            <div
              style={{
                fontSize: 14,
                color: tokens.color.text,
                fontFamily: tokens.font.body,
                lineHeight: 1.2,
              }}
            >
              {user.name}
            </div>
            <div
              style={{
                fontSize: 9.5,
                color: tokens.color.ter,
                fontFamily: tokens.font.ui,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              {user.email} · {user.role}
            </div>
          </div>
          <div style={{ height: 1, background: tokens.color.border, marginBottom: 4 }} />
          <form action={signOut} style={{ margin: 0 }}>
            <button
              type="submit"
              role="menuitem"
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: tokens.color.text,
                fontFamily: tokens.font.body,
                padding: "8px 14px",
                lineHeight: 1.2,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.color.margin;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
