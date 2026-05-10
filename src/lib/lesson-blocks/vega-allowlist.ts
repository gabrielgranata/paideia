// Narrow Vega-Lite allow-list.
//
// Full Vega-Lite is huge. We constrain the LLM to a small subset:
//   - marks: bar, line, point, area
//   - encodings: x, y, color (and category aliases)
//   - inline data ONLY — the LLM cannot emit URLs (which it might hallucinate
//     and which would also leak external requests at render time).
//
// This is intentionally restrictive. If a chart type the teacher needs is
// missing, opening the allow-list is an architecture-layer decision: we
// audit it, expand the schema, expand the renderer. Same discipline as the
// A2UI catalog.

import { z } from "zod";

const FieldTypeSchema = z.enum(["quantitative", "temporal", "ordinal", "nominal"]);

const ChannelDefSchema = z.object({
  field: z.string().min(1),
  type: FieldTypeSchema,
  title: z.string().optional(),
});
type ChannelDef = z.infer<typeof ChannelDefSchema>;

const EncodingSchema = z.object({
  x: ChannelDefSchema.optional(),
  y: ChannelDefSchema.optional(),
  color: ChannelDefSchema.optional(),
});

export const VegaLiteSpecSchema = z.object({
  // The spec only carries presentation. The data array lives on the segment
  // (so we can audit provenance). The renderer merges them.
  mark: z.enum(["bar", "line", "point", "area"]),
  encoding: EncodingSchema,
  title: z.string().optional(),
});
export type VegaLiteSpec = z.infer<typeof VegaLiteSpecSchema>;

/**
 * Build a full Vega-Lite spec object from our narrow schema + inline data.
 * This is what react-vega receives. We assemble it server-side or in the
 * renderer; the LLM only emits the narrow schema.
 */
export function buildVegaLiteSpec(
  spec: VegaLiteSpec,
  data: Array<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    data: { values: data },
    mark: spec.mark,
    encoding: spec.encoding as unknown as Record<string, ChannelDef>,
    title: spec.title,
    width: "container",
    height: 240,
  };
}
