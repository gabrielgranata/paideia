import Link from "next/link";
import { sql } from "@/lib/db";
import { tokens, type Stage, STAGE_LABEL } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { requireRole } from "@/lib/auth";
import { composeClassSummary } from "@/app/actions/teacher";

// Mr. K's class dashboard. Reads enrolled students for course_apwh_2024,
// renders them as a grid with stage chips and a flagged-warrant marker.
// Filter chips at the top operate via search params (?filter=). The
// class-summary bar at the top is hand-authored copy for v0; production
// would compose it from the cohort's substrate.

type ClassRow = {
  student_id: string;
  name: string;
  stage: Stage | null;
  summary: string | null;
  flagged: boolean;
};

type Filter = "all" | "flagged" | "emerging" | "developing" | "proficient" | "extending" | "ie";
const FILTERS: Filter[] = ["all", "flagged", "emerging", "developing", "proficient", "extending", "ie"];

export default async function TeacherDashboard({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireRole("teacher");
  const { filter: filterParam } = await searchParams;
  const filter: Filter = (FILTERS as string[]).includes(filterParam ?? "")
    ? (filterParam as Filter)
    : "all";

  if (!user.teacher_id) throw new Error("Teacher account is missing teacher_id");

  // Pick the teacher's most recent course. v0 assumes one teacher = one
  // active course; a course selector lands when a teacher actually has more.
  const courseRows = (await sql`
    select id, title, subject, term, last_class_summary, last_class_summary_at
    from courses
    where teacher_id = ${user.teacher_id}
    order by created_at desc
    limit 1
  `) as unknown as Array<{
    id: string;
    title: string;
    subject: string | null;
    term: string | null;
    last_class_summary: { summary: string; recurring_pattern: string | null } | null;
    last_class_summary_at: Date | null;
  }>;
  const course = courseRows[0];
  const courseTitle = course?.title ?? "Class";
  const courseSubtitle = [course?.subject, course?.term].filter(Boolean).join(" · ") || null;
  const classSummary = course?.last_class_summary ?? null;
  const classSummaryAt = course?.last_class_summary_at ?? null;

  const all = course
    ? ((await sql`
        select s.id as student_id, s.name, s.stage, s.summary, s.flagged
        from course_enrollments e
        join students s on s.id = e.student_id
        where e.course_id = ${course.id}
        order by s.flagged desc, s.name asc
      `) as unknown as ClassRow[])
    : [];

  const filtered = all.filter((s) => {
    if (filter === "all") return true;
    if (filter === "flagged") return s.flagged;
    return s.stage === filter;
  });

  const flaggedCount = all.filter((s) => s.flagged).length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: tokens.color.canvas,
      }}
    >
      <Chrome
        title={courseTitle}
        subtitle={courseSubtitle ?? undefined}
        right={`${all.length} students · ${flaggedCount} flagged`}
        user={user}
      >
        <Link
          href="/teacher/lessons/new"
          style={{
            fontSize: 10,
            color: tokens.ai.bg,
            background: tokens.ai.label,
            padding: "5px 12px",
            borderRadius: 4,
            fontFamily: tokens.font.ui,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          + New Lesson
        </Link>
      </Chrome>

      {/* Filter bar */}
      <div
        style={{
          padding: "10px 36px",
          borderBottom: `1px solid ${tokens.color.border}`,
          background: tokens.color.canvas,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        {FILTERS.map((f) => {
          const active = filter === f;
          const label =
            f === "all" ? "All" : f === "flagged" ? "Flagged" : STAGE_LABEL[f];
          return (
            <Link
              key={f}
              href={f === "all" ? "/teacher" : `/teacher?filter=${f}`}
              scroll={false}
              style={{
                padding: "5px 12px",
                borderRadius: 4,
                border: `1px solid ${tokens.color.border}`,
                background: active ? tokens.ai.bg : tokens.color.canvas,
                color: active ? tokens.ai.label : tokens.color.sec,
                fontFamily: tokens.font.ui,
                fontSize: 11,
                fontWeight: active ? 700 : 400,
                letterSpacing: "0.03em",
                textDecoration: "none",
              }}
            >
              {label}
            </Link>
          );
        })}
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 10,
            color: tokens.ai.label,
            fontFamily: tokens.font.ui,
            letterSpacing: "0.04em",
            fontWeight: 600,
          }}
        >
          {tokens.aiMarker} CLASS SUMMARY
        </span>
      </div>

      {/* Class summary AI bar — composed by class-summary LLM, persisted on
          courses.last_class_summary. Refresh button triggers a recompose. */}
      <div
        style={{
          padding: "12px 36px",
          borderBottom: `1px solid ${tokens.color.border}`,
          background: tokens.ai.bg,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 10,
            fontWeight: 700,
            color: tokens.ai.label,
            letterSpacing: "0.08em",
            paddingTop: 2,
          }}
        >
          {tokens.aiMarker}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {classSummary ? (
            <>
              <p
                style={{
                  fontFamily: tokens.font.body,
                  fontSize: 13,
                  fontStyle: "italic",
                  color: tokens.ai.text,
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                {classSummary.summary}
              </p>
              {classSummary.recurring_pattern && (
                <p
                  style={{
                    fontFamily: tokens.font.body,
                    fontSize: 12,
                    fontStyle: "italic",
                    color: tokens.ai.text,
                    margin: "6px 0 0",
                    lineHeight: 1.5,
                    opacity: 0.85,
                  }}
                >
                  Recurring pattern: {classSummary.recurring_pattern}
                </p>
              )}
            </>
          ) : (
            <p
              style={{
                fontFamily: tokens.font.body,
                fontSize: 13,
                fontStyle: "italic",
                color: tokens.ai.text,
                margin: 0,
                lineHeight: 1.55,
                opacity: 0.7,
              }}
            >
              No class summary yet — click Refresh to compose one from the cohort&apos;s readings.
            </p>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <form action={composeClassSummary}>
            <input type="hidden" name="course_id" value={course?.id ?? ""} />
            <button
              type="submit"
              title="Re-compose the class summary from current cohort readings (~3-5s)."
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 9,
                fontWeight: 700,
                color: tokens.ai.label,
                fontFamily: tokens.font.ui,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              Refresh →
            </button>
          </form>
          {classSummaryAt && (
            <span
              style={{
                fontFamily: tokens.font.ui,
                fontSize: 8,
                color: tokens.ai.label,
                opacity: 0.6,
                letterSpacing: "0.04em",
              }}
            >
              {new Date(classSummaryAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Student grid */}
      <div style={{ flex: 1, padding: "20px 36px", overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <p
            style={{
              fontSize: 13,
              fontStyle: "italic",
              color: tokens.color.ter,
              textAlign: "center",
              padding: "40px 0",
              fontFamily: tokens.font.body,
            }}
          >
            No students match this filter.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {filtered.map((s) => (
              <StudentCard key={s.student_id} row={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StudentCard({ row }: { row: ClassRow }) {
  const stageStyle = row.stage ? tokens.stage[row.stage] : null;
  return (
    <Link
      href={`/teacher/student/${row.student_id}`}
      style={{
        borderRadius: 7,
        border: row.flagged
          ? `1px solid ${tokens.color.flagBd}`
          : `1px solid ${tokens.color.border}`,
        borderLeft: row.flagged
          ? `3px solid ${tokens.color.flagLabel}`
          : "3px solid transparent",
        background: tokens.color.panel,
        padding: "13px 16px",
        boxShadow: tokens.shadow,
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 7,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.body,
            fontSize: 13,
            fontWeight: 600,
            color: tokens.color.text,
          }}
        >
          {row.name}
        </span>
        {stageStyle && (
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 9px",
              borderRadius: 20,
              background: stageStyle.bg,
              color: stageStyle.text,
            }}
          >
            {row.stage && STAGE_LABEL[row.stage]}
          </span>
        )}
      </div>
      <p
        style={{
          fontFamily: tokens.font.body,
          fontSize: 12,
          lineHeight: 1.5,
          color: tokens.color.sec,
          margin: 0,
        }}
      >
        {row.summary ?? "No reading yet."}
      </p>
      {row.flagged && (
        <div
          style={{
            marginTop: 8,
            fontFamily: tokens.font.ui,
            fontSize: 11,
            fontWeight: 600,
            color: tokens.color.flagLabel,
            letterSpacing: "0.04em",
          }}
        >
          Warrant missing
        </div>
      )}
    </Link>
  );
}

