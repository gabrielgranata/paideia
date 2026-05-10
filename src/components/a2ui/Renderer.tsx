import { parseA2UISpec, type A2UISpec, type A2UIComponent } from "@/lib/a2ui/spec";
import ComposedNarrative from "./ComposedNarrative";
import QuestionPrompt from "./QuestionPrompt";
import ArtifactCard from "./ArtifactCard";
import ArtifactGrid from "./ArtifactGrid";
import SourceReference from "./SourceReference";

type Props = {
  spec: A2UISpec | unknown;
};

/**
 * The boundary between probability space (composer LLM) and deterministic
 * space (DOM). We re-validate here even if the caller claims the spec is
 * typed — invalidation must be loud, not silently rendered as half-broken UI.
 */
export default function Renderer({ spec }: Props) {
  const validated = parseA2UISpec(spec);
  const byId = new Map(validated.components.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col gap-8">
      {validated.root_ids.map((rid) => {
        const c = byId.get(rid)!; // parseA2UISpec guarantees presence
        return <RenderOne key={rid} component={c} spec={validated} />;
      })}
    </div>
  );
}

function RenderOne({
  component,
  spec,
}: {
  component: A2UIComponent;
  spec: A2UISpec;
}) {
  switch (component.type) {
    case "ComposedNarrative":
      return <ComposedNarrative {...component.props} />;
    case "QuestionPrompt":
      return <QuestionPrompt {...component.props} />;
    case "ArtifactCard":
      return <ArtifactCard {...component.props} />;
    case "ArtifactGrid":
      return <ArtifactGrid card_ids={component.props.card_ids} spec={spec} />;
    case "SourceReference":
      return <SourceReference {...component.props} />;
  }
}
