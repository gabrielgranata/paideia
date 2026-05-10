import { z } from "zod";

/**
 * A2UI spec — the FFI between the composer LLM (probability space) and
 * the renderer (deterministic space). Validate at the boundary; throw loudly.
 *
 * The catalog is locked: five component types only. The renderer renders
 * what the substrate already contains; it never generates.
 */

// ---------- Component prop schemas ----------

export const SentenceSchema = z.object({
  text: z.string().min(1),
  // Node IDs this sentence derives from. Empty array allowed only for meta-prose
  // (e.g. "Your argument so far:"). The renderer signals uncited prose visually
  // — uncited content is the drift signal we are trying to detect.
  cites: z.array(z.string()),
});
export type Sentence = z.infer<typeof SentenceSchema>;

export const ComposedNarrativePropsSchema = z.object({
  sentences: z.array(SentenceSchema).min(1),
});
export type ComposedNarrativeProps = z.infer<typeof ComposedNarrativePropsSchema>;

export const QuestionPromptPropsSchema = z.object({
  question: z.string().min(1),
  // Nodes the question is asking about / the gap touches.
  target_node_ids: z.array(z.string()),
  // Free-form descriptor: "missing warrant", "unresolved tension", etc.
  gap_type: z.string().min(1),
});
export type QuestionPromptProps = z.infer<typeof QuestionPromptPropsSchema>;

export const ArtifactCardPropsSchema = z.object({
  artifact_id: z.string().min(1),
  title: z.string().min(1),
  type: z.string().min(1),
  blurb: z.string(),
});
export type ArtifactCardProps = z.infer<typeof ArtifactCardPropsSchema>;

export const ArtifactGridPropsSchema = z.object({
  // References to other components (by id) in the same spec. Resolved at render.
  card_ids: z.array(z.string()).min(1),
});
export type ArtifactGridProps = z.infer<typeof ArtifactGridPropsSchema>;

export const SourceReferencePropsSchema = z.object({
  ref_type: z.enum(["node", "document", "memory"]),
  ref_id: z.string().min(1),
  label: z.string().min(1),
});
export type SourceReferenceProps = z.infer<typeof SourceReferencePropsSchema>;

// ---------- Discriminated component union ----------

export const ComponentSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("ComposedNarrative"),
    props: ComposedNarrativePropsSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("QuestionPrompt"),
    props: QuestionPromptPropsSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("ArtifactCard"),
    props: ArtifactCardPropsSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("ArtifactGrid"),
    props: ArtifactGridPropsSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("SourceReference"),
    props: SourceReferencePropsSchema,
  }),
]);
export type A2UIComponent = z.infer<typeof ComponentSchema>;

export type A2UIComponentType = A2UIComponent["type"];

// ---------- Spec ----------

export const A2UISpecSchema = z.object({
  components: z.array(ComponentSchema).min(1),
  // Top-level components in render order. Each must be present in `components`.
  root_ids: z.array(z.string().min(1)).min(1),
});
export type A2UISpec = z.infer<typeof A2UISpecSchema>;

/**
 * Parse and validate an A2UI spec. Throws ZodError on invalid input.
 *
 * Additionally enforces structural invariants Zod alone cannot:
 *  - every root_id resolves to a component
 *  - every ArtifactGrid card_id resolves to an ArtifactCard component
 *  - component ids are unique
 */
export function parseA2UISpec(input: unknown): A2UISpec {
  const spec = A2UISpecSchema.parse(input);

  const byId = new Map<string, A2UIComponent>();
  for (const c of spec.components) {
    if (byId.has(c.id)) {
      throw new Error(`A2UI spec invalid: duplicate component id "${c.id}"`);
    }
    byId.set(c.id, c);
  }

  for (const rid of spec.root_ids) {
    if (!byId.has(rid)) {
      throw new Error(`A2UI spec invalid: root_id "${rid}" not found in components`);
    }
  }

  for (const c of spec.components) {
    if (c.type === "ArtifactGrid") {
      for (const cardId of c.props.card_ids) {
        const ref = byId.get(cardId);
        if (!ref) {
          throw new Error(
            `A2UI spec invalid: ArtifactGrid "${c.id}" references missing component "${cardId}"`,
          );
        }
        if (ref.type !== "ArtifactCard") {
          throw new Error(
            `A2UI spec invalid: ArtifactGrid "${c.id}" card_id "${cardId}" must reference an ArtifactCard, got ${ref.type}`,
          );
        }
      }
    }
  }

  return spec;
}
