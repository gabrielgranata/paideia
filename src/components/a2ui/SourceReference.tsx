"use client";

import { useState } from "react";
import { tokens } from "@/lib/design/tokens";
import type { SourceReferenceProps } from "@/lib/a2ui/spec";

const PREFIX: Record<SourceReferenceProps["ref_type"], string> = {
  node: "node",
  document: "document",
  memory: "memory",
};

/**
 * Inline pill — italic EB Garamond at 11px, transparent background, 1px
 * border in the warm border tone, with a literal "↗" arrow as the only
 * affordance. Click expands to show the ref_type and ref_id; click again
 * collapses back to the bare label.
 *
 * The pill is a pointer at a source, never a substitute for it. The
 * student must click through to read the actual material — Paideia rule:
 * "material reference points at the source, not at a conclusion drawn
 * from it."
 */
export default function SourceReference({
  ref_type,
  ref_id,
  label,
}: SourceReferenceProps) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      title={`${PREFIX[ref_type]}: ${ref_id}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 11px",
        fontSize: 11,
        color: tokens.color.sec,
        background: "transparent",
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 2,
        cursor: "pointer",
        fontFamily: tokens.font.body,
        fontStyle: "italic",
        lineHeight: 1.3,
      }}
    >
      <span aria-hidden="true">↗</span>
      <span>{label}</span>
      {open && (
        <span
          style={{
            marginLeft: 4,
            paddingLeft: 8,
            borderLeft: `1px solid ${tokens.color.border}`,
            color: tokens.color.ter,
            fontStyle: "normal",
            fontFamily: tokens.font.ui,
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {PREFIX[ref_type]} · {ref_id}
        </span>
      )}
    </button>
  );
}
