"use client";

// Pure presentational component for an AIChartSegment. No TipTap, no
// editor coupling — just renders the chart, caption, caveat (if AI-
// proposed data), and the provenance footer.
//
// Used in two places:
//   - reading editor (via ChartSegmentView, which thin-wraps this in a
//     TipTap NodeViewWrapper)
//   - ai_generated block editor (used directly)
//
// Provenance discipline lives here, not at the call site: data_source
// is always shown, the caveat for AI-proposed data is always visible,
// and the data array is auditable via the show-data disclosure.

import { useState } from "react";
import { VegaEmbed } from "react-vega";
import { tokens } from "@/lib/design/tokens";
import { buildVegaLiteSpec, type AIChartSegment } from "@/lib/lesson-blocks";

function provenanceLabel(seg: AIChartSegment): string {
  switch (seg.data_source.kind) {
    case "teacher_supplied":
      return "Teacher-supplied data";
    case "ai_extracted_from_text":
      return `AI extracted from ${seg.data_source.source_text_origin}`;
    case "ai_proposed_from_topic":
      return "AI-proposed illustrative data";
  }
}

export function AIChartFigure({
  segment,
  onRemove,
}: {
  segment: AIChartSegment;
  onRemove?: () => void;
}) {
  const [showData, setShowData] = useState(false);
  const fullSpec = buildVegaLiteSpec(segment.chart_spec, segment.data);
  const isProposed = segment.data_source.kind === "ai_proposed_from_topic";

  return (
    <div
      style={{
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 3,
        background: tokens.color.cardLight,
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          background: tokens.color.margin,
          borderBottom: `1px solid ${tokens.color.border}`,
        }}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: tokens.color.ter,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontFamily: tokens.font.ui,
          }}
        >
          {tokens.aiMarker} AI chart
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{
              marginLeft: "auto",
              fontSize: 8,
              color: tokens.color.faint,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: tokens.font.ui,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            ✕ Remove
          </button>
        )}
      </header>

      <div style={{ padding: "10px 12px" }}>
        <VegaEmbed
          spec={fullSpec as Parameters<typeof VegaEmbed>[0]["spec"]}
          options={{ actions: false, renderer: "svg" }}
        />
      </div>

      <figcaption
        style={{
          padding: "8px 12px 10px",
          fontSize: 12,
          color: tokens.color.text,
          fontFamily: tokens.font.body,
          fontStyle: "italic",
          lineHeight: 1.5,
        }}
      >
        {segment.caption}
      </figcaption>

      {isProposed && segment.data_source.kind === "ai_proposed_from_topic" && (
        <div
          style={{
            padding: "8px 12px",
            background: tokens.color.flagBg,
            borderTop: `1px solid ${tokens.color.flagBd}`,
            color: tokens.color.flagText,
            fontFamily: tokens.font.body,
            fontStyle: "italic",
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {segment.data_source.caveat}
        </div>
      )}

      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderTop: `1px solid ${tokens.color.border}`,
          background: tokens.color.canvas,
          fontFamily: tokens.font.ui,
          fontSize: 9,
          color: tokens.color.ter,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span>{provenanceLabel(segment)}</span>
        <button
          type="button"
          onClick={() => setShowData((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: tokens.color.ter,
            fontFamily: tokens.font.ui,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: 9,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {showData ? "Hide data" : "Show data"}
        </button>
      </footer>

      {showData && (
        <pre
          style={{
            margin: 0,
            padding: "8px 12px",
            background: tokens.color.canvas,
            color: tokens.color.sec,
            fontSize: 10,
            fontFamily: tokens.font.mono,
            lineHeight: 1.5,
            maxHeight: 200,
            overflow: "auto",
            borderTop: `1px solid ${tokens.color.border}`,
          }}
        >
          {JSON.stringify(segment.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
