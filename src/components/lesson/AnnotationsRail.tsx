import { tokens } from "@/lib/design/tokens";

// AnnotationsRail — the right-hand stream of AI observations surfaced by
// past turns. Position is the signal: AI lives on the edge of the writing,
// never inside it. The student keeps writing; observations accumulate
// alongside, newest at top.
//
// v0 is a chronological list — annotations aren't paragraph-anchored.
// Tight binding to a specific sentence in the writing requires substrate
// nodes tagged with text offsets, which the turn-call doesn't yet emit.

type RailTurn = {
  id: string;
  created_at: Date;
  next_gap: { prompt: string; type: string } | null;
};

export default function AnnotationsRail({ turns }: { turns: RailTurn[] }) {
  // Newest first. Drop turns that didn't surface a gap (LLM failure or
  // the substrate was too thin to ask).
  const annotated = [...turns]
    .filter((t) => t.next_gap && t.next_gap.prompt.trim().length > 0)
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  return (
    <aside
      aria-label="AI observations on your writing"
      style={{
        width: 260,
        flexShrink: 0,
        padding: "20px 18px",
        borderLeft: `1px solid ${tokens.color.border}`,
        background: tokens.color.canvas,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: tokens.color.ter,
          marginBottom: 4,
        }}
      >
        {tokens.aiMarker} Observations
      </div>

      {annotated.length === 0 ? (
        <p
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12,
            fontStyle: "italic",
            color: tokens.color.ter,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Observations land here as you save. Each one is a question only
          you can answer from inside your own thinking.
        </p>
      ) : (
        annotated.map((t) => <Annotation key={t.id} turn={t} />)
      )}
    </aside>
  );
}

function Annotation({ turn }: { turn: RailTurn }) {
  if (!turn.next_gap) return null;
  const when = new Date(turn.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <article
      style={{
        paddingLeft: 12,
        borderLeft: `2px solid ${tokens.ai.border}`,
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: tokens.ai.label,
          marginBottom: 6,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>{tokens.aiMarker} {prettyType(turn.next_gap.type)}</span>
        <span
          style={{
            color: tokens.color.faint,
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "none",
          }}
        >
          {when}
        </span>
      </div>
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          fontStyle: "italic",
          lineHeight: 1.65,
          color: tokens.ai.text,
          margin: 0,
        }}
      >
        {turn.next_gap.prompt}
      </p>
    </article>
  );
}

// Map the closed move-type vocabulary to a label that reads. The schema
// gives us: observation, question, structural-prompt, named-tension,
// missing-perspective, candidate-counterexample.
function prettyType(t: string): string {
  switch (t) {
    case "observation":
      return "Observation";
    case "question":
      return "Question";
    case "structural-prompt":
      return "Structural prompt";
    case "named-tension":
      return "Tension";
    case "missing-perspective":
      return "Missing perspective";
    case "candidate-counterexample":
      return "Counterexample";
    default:
      return "Observation";
  }
}
