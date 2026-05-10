import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";
import {
  getOrCreateScope,
  getBackboardClient,
  type BackboardMemory,
} from "@/lib/backboard";

// Teacher memory surface. Lists every memory accumulated on Mr. K's
// per-teacher backboard assistant — primarily teacher_note entries from
// annotations he's sent. This is the teacher's working memory across the
// cohort.

type MemoryItem = BackboardMemory;

export default async function TeacherMemoryPage() {
  const user = await requireRole("teacher");
  if (!user.teacher_id) throw new Error("Teacher account is missing teacher_id");

  let memories: MemoryItem[] = [];
  let backboardError: string | null = null;
  try {
    const assistantId = await getOrCreateScope("teacher", user.teacher_id);
    const result = await getBackboardClient().getMemories(assistantId);
    memories = (result.memories ?? []).slice().sort(byCreatedDesc);
  } catch (err) {
    console.error("[teacher memory page] failed to fetch memories:", err);
    backboardError =
      "Memory layer is currently unreachable. Postgres holds the ground truth, but cross-class observations can't be read right now.";
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
      <Chrome title={user.name} subtitle="Memory" backHref="/teacher" backLabel="Class" user={user} />

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
            What you&apos;ve noticed across the class
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
            Annotations you send to students are captured here. Your reading of
            patterns across the cohort accumulates as you work.
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
            No notes yet. Send an annotation from a student detail page and it
            will appear here, alongside any cross-class observations you record
            over time.
          </div>
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

function MemoryCard({ memory }: { memory: MemoryItem }) {
  const meta = (memory.metadata ?? {}) as Record<string, unknown>;
  const type = typeof meta.type === "string" ? meta.type : "auto";
  const studentId = typeof meta.student_id === "string" ? meta.student_id : null;
  const targetType = typeof meta.target_type === "string" ? meta.target_type : null;
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
          {studentId && ` · ${studentId.replace(/^student_/, "")}`}
          {targetType && ` · ${targetType}`}
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
    case "teacher_note":
      return "Note";
    case "cross_class":
      return "Cross-class";
    default:
      return t.replace(/_/g, " ");
  }
}

function byCreatedDesc(a: MemoryItem, b: MemoryItem): number {
  const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
  return bd - ad;
}

