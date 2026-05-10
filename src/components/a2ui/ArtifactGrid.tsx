import type { A2UISpec } from "@/lib/a2ui/spec";
import ArtifactCard from "./ArtifactCard";

type Props = {
  card_ids: string[];
  // The grid resolves card references against the parent spec's component map.
  spec: A2UISpec;
};

/**
 * Resolves card_ids against the spec; renders each as ArtifactCard.
 * Validation in `parseA2UISpec` guarantees the references exist and are
 * ArtifactCards — by the time we get here, the lookup is total.
 *
 * Direction E: a strict 3-column grid with a 14px gap, matching the V1
 * artifact home wireframe. Fixed columns rather than responsive collapse:
 * the artifact home reads as a settled, gridded surface, not a fluid feed.
 */
export default function ArtifactGrid({ card_ids, spec }: Props) {
  const cards = card_ids.map((id) => {
    const c = spec.components.find((x) => x.id === id);
    // Defensive: parseA2UISpec already enforced this, but render-time guard
    // keeps the failure mode loud rather than crashing on undefined props.
    if (!c || c.type !== "ArtifactCard") {
      throw new Error(
        `ArtifactGrid: card_id "${id}" did not resolve to an ArtifactCard`,
      );
    }
    return c;
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 14,
      }}
    >
      {cards.map((c) => (
        <ArtifactCard key={c.id} {...c.props} />
      ))}
    </div>
  );
}
