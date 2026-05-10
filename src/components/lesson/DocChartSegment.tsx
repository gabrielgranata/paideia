"use client";

// Student-side renderer for an AI chart segment inside a reading Doc.
// Mirrors the teacher-side ChartSegmentView visually, but read-only: no
// remove control, no "show data" disclosure. Provenance label and caveat
// stay — the schema requires the caveat for `ai_proposed_from_topic`, and
// the renderer must always surface it (the structural defense against
// the AI silently asserting illustrative data as authoritative).

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

export default function DocChartSegment({ segment }: { segment: AIChartSegment }) {
  const fullSpec = buildVegaLiteSpec(segment.chart_spec, segment.data);
  const isProposed = segment.data_source.kind === "ai_proposed_from_topic";

  return (
    <figure
      data-segment-kind="ai-chart"
      style={{
        margin: "14px 0",
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 3,
        background: tokens.color.cardLight,
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "8px 12px",
          background: tokens.color.margin,
          borderBottom: `1px solid ${tokens.color.border}`,
          fontSize: 8,
          fontWeight: 700,
          color: tokens.color.ter,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontFamily: tokens.font.ui,
        }}
      >
        {tokens.aiMarker} AI chart
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
        {provenanceLabel(segment)}
      </footer>
    </figure>
  );
}
