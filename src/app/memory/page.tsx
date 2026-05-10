import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";
import {
  getOrCreateScope,
  getBackboardClient,
  type BackboardMemory,
} from "@/lib/backboard";

// Student memory surface. Lists every memory accumulated on this student's
// per-student backboard assistant. The student owns their record — this is
// where the platform's metacognitive claim becomes concrete.
//
// memory_auto entries (from memory="Auto" turns) carry whatever metadata
// backboard infers; explicit writes (e.g. annotations from a teacher) carry
// our metadata.type tags. We render either with the same shape; the type
// chip distinguishes them.

type MemoryItem = BackboardMemory;

export default async function StudentMemoryPage() {
  const user = await requireRole("student");
  if (!user.student_id) throw new Error("Student account is missing student_id");

  let memories: MemoryItem[] = [];
  let backboardError: string | null = null;
  try {
    const assistantId = await getOrCreateScope("student", user.student_id);
    const result = await getBackboardClient().getMemories(assistantId);
    memories = (result.memories ?? []).slice().sort(byCreatedDesc);
  } catch (err) {
    console.error("[memory page] failed to fetch memories:", err);
    backboardError =
      "Memory layer is currently unreachable. Your work is safe — Postgres holds the ground truth — but the long-horizon profile can't be read right now.";
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: tokens.color.canvas,
      }}
    >
      <Chrome title={user.name} subtitle="Memory" backHref="/artifacts" backLabel="Your work" user={user} />

      <div style={{ flex: 1, padding: "28px 36px", maxWidth: 880, margin: "0 auto", width: "100%" }}>
        <header style={{ marginBottom: 22 }}>
          <h1
            style={{
              fontFamily: tokens.font.body,
              fontSize: 24,
              fontStyle: "italic",
              fontWeight: 500,
              color: tokens.color.text,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            What the system has noticed about your reasoning
          </h1>
          <p
            style={{
              fontFamily: tokens.font.body,
              fontSize: 13,
              color: tokens.color.sec,
              margin: "8px 0 0",
              fontStyle: "italic",
            }}
          >
            Read-only. Memory accumulates as you work; deleting an entry from
            here is not yet wired (it would require a delete-then-add round-trip
            to backboard).
          </p>
        </header>

        {backboardError ? (
          <div
            style={{
              padding: "16px 20px",
              border: `1px solid ${tokens.color.flagBd}`,
              background: tokens.color.flagBg,
              borderRadius: 4,
              fontFamily: tokens.font.body,
              fontSize: 13,
              color: tokens.color.flagText,
              fontStyle: "italic",
            }}
          >
            {backboardError}
          </div>
        ) : memories.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {memories.map((m) => (
              <MemoryCard key={m.id} memory={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "40px 32px",
        background: tokens.color.cardLight,
        border: `1px dashed ${tokens.color.border}`,
        borderRadius: 4,
        textAlign: "center",
        fontFamily: tokens.font.body,
        fontStyle: "italic",
        color: tokens.color.sec,
        fontSize: 14,
        lineHeight: 1.7,
      }}
    >
      Nothing here yet. As you work through lessons and your teacher leaves
      questions for you, what you&apos;ve reasoned through and what&apos;s been
      noticed about it will accumulate here.
    </div>
  );
}

function MemoryCard({ memory }: { memory: MemoryItem }) {
  const meta = (memory.metadata ?? {}) as Record<string, unknown>;
  const type = typeof meta.type === "string" ? meta.type : "auto";
  const written = memory.created_at ? new Date(memory.created_at) : null;
  return (
    <article
      style={{
        background: tokens.color.cardLight,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 5,
        padding: "16px 20px",
        boxShadow: tokens.shadow,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 9,
            fontWeight: 700,
            color: tokens.ai.label,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
          }}
        >
          {tokens.aiMarker} {prettyType(type)}
        </span>
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 9,
            color: tokens.color.faint,
            letterSpacing: "0.06em",
          }}
        >
          {written ? written.toLocaleString() : "—"}
        </span>
      </div>
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 14,
          lineHeight: 1.7,
          color: tokens.color.text,
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {memory.content}
      </p>
    </article>
  );
}

function prettyType(t: string): string {
  switch (t) {
    case "auto":
      return "Noticed";
    case "reading":
      return "Reading";
    case "cohort_pattern":
      return "Cohort pattern";
    case "teacher_note":
      return "Teacher note";
    default:
      return t.replace(/_/g, " ");
  }
}

function byCreatedDesc(a: MemoryItem, b: MemoryItem): number {
  const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
  return bd - ad;
}

