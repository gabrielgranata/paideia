"use client";

// Pure presentational component for an AIDiagramSegment. SVG layout —
// circle for ≤6 nodes, 3-wide grid for more. Edges are typed by relation
// (positive solid / negative dashed / depends dotted).
//
// Used by reading editor (via DiagramSegmentView NodeView wrapper) and
// the ai_generated block editor (directly).

import { tokens } from "@/lib/design/tokens";
import type { AIDiagramSegment } from "@/lib/lesson-blocks";

type Coord = { x: number; y: number };

function layoutCircle(count: number, width: number, height: number): Coord[] {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.36;
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
}

function layoutGrid(count: number, width: number, height: number): Coord[] {
  const cols = 3;
  const rows = Math.ceil(count / cols);
  const stepX = width / (cols + 1);
  const stepY = height / (rows + 1);
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return { x: stepX * (col + 1), y: stepY * (row + 1) };
  });
}

const REL_STYLE: Record<
  "positive" | "negative" | "depends",
  { stroke: string; dash: string }
> = {
  positive: { stroke: tokens.color.text, dash: "0" },
  negative: { stroke: tokens.color.flagBd, dash: "4 3" },
  depends: { stroke: tokens.color.ter, dash: "2 4" },
};

export function AIDiagramFigure({
  segment,
  onRemove,
}: {
  segment: AIDiagramSegment;
  onRemove?: () => void;
}) {
  const width = 520;
  const height = Math.max(260, 80 + Math.ceil(segment.nodes.length / 3) * 110);
  const positions =
    segment.nodes.length <= 6
      ? layoutCircle(segment.nodes.length, width, height)
      : layoutGrid(segment.nodes.length, width, height);

  const posById = new Map<string, Coord>();
  segment.nodes.forEach((n, i) => posById.set(n.id, positions[i]));

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
          {tokens.aiMarker} AI diagram
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

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ background: tokens.color.cardLight, display: "block" }}
        role="img"
        aria-label={segment.caption}
      >
        {segment.edges.map((e, i) => {
          const a = posById.get(e.src);
          const b = posById.get(e.dst);
          if (!a || !b) return null;
          const style = REL_STYLE[e.relation];
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          return (
            <g key={`e${i}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={style.stroke}
                strokeWidth={1.2}
                strokeDasharray={style.dash}
                markerEnd="url(#arrow)"
              />
              <text
                x={midX}
                y={midY - 4}
                textAnchor="middle"
                fontFamily={tokens.font.ui}
                fontSize={9}
                fill={tokens.color.faint}
                style={{ letterSpacing: "0.04em" }}
              >
                {e.kind}
              </text>
            </g>
          );
        })}

        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={tokens.color.text} />
          </marker>
        </defs>

        {segment.nodes.map((n) => {
          const pos = posById.get(n.id);
          if (!pos) return null;
          return (
            <g key={n.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                x={-60}
                y={-22}
                width={120}
                height={44}
                rx={3}
                ry={3}
                fill={tokens.color.panel}
                stroke={tokens.color.border}
                strokeWidth={1}
              />
              <text
                x={0}
                y={-4}
                textAnchor="middle"
                fontFamily={tokens.font.body}
                fontSize={11}
                fill={tokens.color.text}
                fontWeight={600}
              >
                {n.label.length > 18 ? n.label.slice(0, 17) + "…" : n.label}
              </text>
              <text
                x={0}
                y={12}
                textAnchor="middle"
                fontFamily={tokens.font.ui}
                fontSize={8}
                fill={tokens.color.faint}
                style={{ letterSpacing: "0.06em" }}
              >
                {n.kind}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption
        style={{
          padding: "8px 12px 10px",
          fontSize: 12,
          color: tokens.color.text,
          fontFamily: tokens.font.body,
          fontStyle: "italic",
          lineHeight: 1.5,
          borderTop: `1px solid ${tokens.color.border}`,
        }}
      >
        {segment.caption}
      </figcaption>

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
          display: "flex",
          gap: 14,
        }}
      >
        <span>
          {segment.nodes.length} node{segment.nodes.length === 1 ? "" : "s"}
        </span>
        <span>
          {segment.edges.length} edge{segment.edges.length === 1 ? "" : "s"}
        </span>
        <DiagramLegend />
      </footer>
    </div>
  );
}

function DiagramLegend() {
  const items: Array<{ label: string; color: string; dash: string }> = [
    { label: "positive", color: tokens.color.text, dash: "0" },
    { label: "negative", color: tokens.color.flagBd, dash: "4 3" },
    { label: "depends", color: tokens.color.ter, dash: "2 4" },
  ];
  return (
    <span style={{ display: "inline-flex", gap: 10, marginLeft: "auto" }}>
      {items.map((it) => (
        <span
          key={it.label}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <svg width={18} height={6} aria-hidden="true">
            <line
              x1={0}
              y1={3}
              x2={18}
              y2={3}
              stroke={it.color}
              strokeWidth={1.2}
              strokeDasharray={it.dash}
            />
          </svg>
          {it.label}
        </span>
      ))}
    </span>
  );
}
