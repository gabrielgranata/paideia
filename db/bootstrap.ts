// Bootstrap: drops + recreates schema, then seeds enough demo content
// that the script's surfaces can be poked at without having to live-build
// every beat. The script's Phase 0 says "minimal" — we go slightly past
// that so the dashboards aren't blank, but every seeded row is one the
// demo would have produced live.
//
// Run with: npm run db:reset
//
// What's seeded:
//   - Mr. Okafor (teacher) + Maya Chen (student) + 4 stub classmates
//     (so the dashboard reads as a real class)
//   - 4 user accounts (Okafor + Maya only — stubs aren't sign-in-able)
//   - Course "Industrial Revolution & Modernity" (Beat 1)
//   - Lesson 3 "The Making of the Working Class" (Beat 2) with all
//     blocks: context, prompt, three readings (Beat 3), AI-generated
//     chronology (Beat 4), and the response block. Teacher private
//     rubric on the response (Beat 5).
//   - Maya enrolled + her active session on Lesson 3 + four turns
//     (the four sessions from the script) producing substrate
//   - Composed reading on Maya × Lesson 3 (Beat 9)
//   - Two annotations from Mr. Okafor (Beat 8)
//   - Class summary on the course (Beat 11)
//
// Reading/video block content is wrapped in the new Doc shape from
// @/lib/lesson-blocks/schemas to avoid the migration path on read.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "schema.sql");

const url =
  process.env.DATABASE_URL ?? "postgres://paideia:paideia@localhost:5433/paideia";
const sql = postgres(url);

// ── helpers ───────────────────────────────────────────────────────────

function segId(): string {
  return `seg_${randomUUID().slice(0, 8)}`;
}

// Wrap a plain string into a Doc { segments: [{ kind: 'human', body }] }.
// Matches the structured reading shape the planner / lesson page expect.
function doc(body: string) {
  return { segments: [{ id: segId(), kind: "human" as const, body }] };
}

// ── content payloads (script beats) ───────────────────────────────────

const ARC_SEED =
  'By the end of this unit, I want students to be able to think about industrialization not as a wave of technology that happened to people, but as a set of conditions that produced new forms of political consciousness — and to be specific about which mechanism does which work between conditions and consciousness. The hard question I want them carrying out of the unit is whether "the working class" is a category we discover in the historical record or one that comes into being through the activity of the people who eventually name themselves with it.';

const LESSON_PROMPT =
  "Did the Industrial Revolution create the working class, or did the working class create itself?";

const LESSON_CONTEXT =
  'This is the third lesson in a six-week unit on industrialization and modernity. Most students arrive holding the slogan "the factory made the workers." The work of the lesson is to take that slogan seriously enough to argue against it — and to take the opposite reading seriously enough to argue against that too. There\'s no right answer, only a strong one and a weak one, and the difference is whether you actually wrestled with the sources.';

// Beat 3
const HEBERGAM = `Testimony of Joseph Hebergam, age 17, before the Sadler Committee, 1832.

Question: At what age did you commence working in a factory?
Answer: Seven.

Question: What were your hours of labour at that age?
Answer: From five in the morning till eight at night.

Question: What time was allowed for meals?
Answer: Forty minutes at noon.

Question: Had you any time to get breakfast or drinking?
Answer: No, we had to get it as we could.

Question: Did you become very tired toward the end of the day?
Answer: I did, very tired.

Question: Were you beaten if you slackened?
Answer: Yes, the overlooker would strap us.

Question: Has your health suffered?
Answer: My knees are bent inwards, and I cannot stand straight. The doctor says it is from the work. I have a brother and a sister who also worked in the mill from young. My brother is now dead. He died at fourteen. The doctor said it was from the labour.

[Editorial note: testimony abridged for length. The Sadler Committee gathered hundreds of similar accounts in 1832 as part of the parliamentary inquiry that led to the Factory Act of 1833.]`;

const THOMPSON = `From E.P. Thompson, The Making of the English Working Class, 1963 (condensed).

Thompson argues that the working class was not simply produced by the steam engine and the factory. The factory produced workers — but workers are not yet a class. A class exists when people who share a common situation come to recognize that they share it, name themselves, and act together on the basis of that recognition. This is a process, not an event, and it is the work of the workers themselves: in their meetings, their pamphlets, their songs, their strikes, their funerals. Between roughly 1790 and 1832, English working people moved from being a collection of trades and locales — weavers in Lancashire, miners in Durham, artisans in London — into something they began to call, in their own writing, the working class. The economic conditions were the soil. The class was the plant. Soil does not grow itself; the plant does that work.`;

const ENGELS = `From Friedrich Engels, The Condition of the Working Class in England, 1845 (condensed).

Engels, writing as a young man living in Manchester, describes the workers he sees not primarily as agents but as products. The factory system, he argues, creates the proletariat by stripping workers of the property, the craft skills, and the village ties that once gave them an independent footing. What is left is a population of human beings who own nothing but their capacity to labor and who must sell that capacity, daily, to whoever will buy it. Their misery is not incidental to industrial capitalism — it is constitutive of it. Whether or not the workers understand themselves as a class is, for Engels, secondary; the structural fact of their position is what matters, and that position was made for them by the iron logic of the factory.`;

// Beat 4 — AI-generated chronology
const CHRONOLOGY = `From factory system to working class, 1760–1832 — a chronology.

1760s–1780s: Mechanization of textiles begins. Hargreaves' spinning jenny (1764), Arkwright's water frame (1769), Crompton's mule (1779). Production moves from cottages to mills.

1780s–1810s: The factory system spreads across Lancashire (cotton), the West Riding (wool), the Midlands (metalwork). Manchester grows from ~25,000 people in 1771 to ~140,000 by 1831.

1799–1800: The Combination Acts criminalize trade unions and collective bargaining.

1811–1817: The Luddite movement. Skilled textile workers smash mechanized looms across Yorkshire, Lancashire, and Nottinghamshire. The Frame Breaking Act (1812) makes the offence a capital crime.

1819: Peterloo Massacre. Cavalry charge a peaceful pro-reform demonstration in Manchester. ~18 killed, hundreds injured. National outrage; the politicization of working people accelerates.

1824–1825: Combination Acts repealed (partially reinstated in 1825). Unions become legally tolerated.

1830s–1840s: Chartism emerges. The People's Charter (1838) demands universal male suffrage, secret ballot, payment of MPs, annual parliaments. Mass petitions in 1839, 1842, 1848.

1832: Sadler Committee gathers testimony on factory child labor — Joseph Hebergam testifies in this year. The Reform Act 1832 expands the franchise to property-owning men, but not to the working class.

1833: Factory Act 1833. First effective legislation on factory hours: no child labor under 9, under-13s capped at 9-hour days, factory inspectors appointed.

1842–1845: Friedrich Engels lives in Manchester. He publishes The Condition of the Working Class in England (1845) based on these observations.

1963: E.P. Thompson publishes The Making of the English Working Class, arguing — against the structural reading Engels exemplifies — that the class made itself through political activity, not just through being subjected to economic conditions.`;

const PRIVATE_RUBRIC = `EXPECTED DIMENSIONS (private rubric, not shown to students):

1. Engages with the distinction between economic conditions and political consciousness — does not collapse them.
2. Uses at least one primary and one secondary source. Both are present in the materials.
3. Acknowledges that "the working class" is a contested category, not a given. The strong answers name the contestation; the weak ones treat the term as natural.
4. Takes a position rather than hedging. "Both are right in their own way" is the weakest move and the most common.`;

// Beat 9 — composed reading
const MAYA_READING = {
  resolved:
    'Maya has moved from a flat "workers were victims of the factory" framing into the conditions-vs-consciousness distinction. Her engagement with Thompson is genuine — the notes from October 12 show her actually wrestling with the soil-and-plant metaphor rather than just citing it. By October 15 she is articulating the distinction in her own terms: "Engels thinks the structure makes the class whether the workers know it or not; Thompson thinks the class only exists once the workers see themselves that way." This is the move from describing conditions to thinking about consciousness, and it\'s hers.',
  in_progress:
    'Her current load-bearing position is Thompson-aligned: the working class made itself through political consciousness, with the Factory Act of 1833 as the load-bearing piece of evidence. The Hebergam testimony grounds the conditions Thompson\'s workers were responding to. The position is defensible. The vocabulary, however, is forming behind the activity rather than ahead of it — "class solidarity" is sitting in her notes but has not made it into the draft.',
  unaddressed:
    "She has not engaged Engels. The source is in her materials and she's read it (her October 15 notes explicitly contrast Engels with Thompson) but the draft does not cite or address him. Right now she's siding with Thompson by default rather than by argument. The strongest version of her current position requires her to take the Engels reading seriously and explain why she's choosing Thompson — anything less is the \"qualified position that names two mechanisms but can't say which is load-bearing\" failure mode.",
  recommended_next:
    'Ask her to push on the fresh observation about "what exactly changed in how they understood their situation." Pushing on it should bring her to the language her notes are already groping toward — class solidarity — and once that vocabulary is in the draft, the missing engagement with Engels becomes legible to her as a question rather than an absence.',
};

// Beat 11 — class summary
const CLASS_SUMMARY = {
  summary:
    "Most of the class can name a mechanism. The recurring move missing is specificity about which mechanism is load-bearing — students who name two and can't say which one their position depends on are the productive ones to push next.",
  recurring_pattern:
    "students name two mechanisms but can't say which is load-bearing",
};

// ── seed ──────────────────────────────────────────────────────────────

async function main() {
  const schema = readFileSync(schemaPath, "utf8");

  console.log("Resetting schema…");
  await sql.unsafe(schema);

  console.log("Seeding demo content…");

  // Teacher. ID is 'teacher_k' (not 'teacher_okafor') because several
  // server actions and routes hardcode it as the v0 single-teacher ID.
  await sql`insert into teachers (id, name) values ('teacher_k', 'Mr. Okafor')`;

  // Students. Maya is the focused one (the demo's protagonist); the
  // four stubs let the class dashboard read as a real cohort.
  type SeedStudent = {
    id: string;
    name: string;
    stage: "emerging" | "developing" | "proficient" | "extending" | "ie" | null;
    summary: string | null;
    flagged: boolean;
  };
  const students: SeedStudent[] = [
    {
      id: "student_maya",
      name: "Maya Chen",
      stage: "developing",
      summary:
        "Strong move from victims-of-the-factory toward Thompson's consciousness reading. Engels read but not engaged — siding with Thompson by default rather than by argument.",
      flagged: true,
    },
    {
      id: "student_jordan",
      name: "Jordan Park",
      stage: "proficient",
      summary:
        "Engaging both Thompson and Engels seriously; strong primary-source citation discipline.",
      flagged: false,
    },
    {
      id: "student_amir",
      name: "Amir Hassan",
      stage: "emerging",
      summary:
        "Still in narrative mode — describing what happened without staking a position.",
      flagged: false,
    },
    {
      id: "student_sofia",
      name: "Sofia Reyes",
      stage: "developing",
      summary:
        "Names two mechanisms but hedges on which is load-bearing. The classic qualified-position failure mode.",
      flagged: true,
    },
    {
      id: "student_nia",
      name: "Nia Williams",
      stage: "extending",
      summary:
        "Going beyond the materials — beginning to question whether 'the working class' is a useful unit of analysis at all.",
      flagged: false,
    },
  ];
  for (const s of students) {
    await sql`
      insert into students (id, name, stage, summary, flagged)
      values (${s.id}, ${s.name}, ${s.stage}, ${s.summary}, ${s.flagged})
    `;
  }

  // Auth users — only the teacher and Maya can sign in. Stub students
  // exist as visual fixtures on the dashboard, not as login-able accounts.
  await sql`
    insert into users (id, email, name, role, teacher_id, student_id)
    values ('user_mr_k', 'okafor@paideia.edu', 'Mr. Okafor', 'teacher', 'teacher_k', null)
  `;
  await sql`
    insert into users (id, email, name, role, teacher_id, student_id)
    values ('user_maya', 'maya@paideia.edu', 'Maya Chen', 'student', null, 'student_maya')
  `;

  // Course (Beat 1).
  const COURSE_ID = "course_irm_2025";
  await sql`
    insert into courses (
      id, teacher_id, title, subject, term, year_group, arc_seed_text,
      last_class_summary, last_class_summary_at
    )
    values (
      ${COURSE_ID},
      'teacher_k',
      'Industrial Revolution & Modernity',
      'AP World History',
      'Fall 2025',
      'Year 11',
      ${ARC_SEED},
      ${sql.json(CLASS_SUMMARY)},
      now()
    )
  `;

  // Enroll all students in the course.
  for (const s of students) {
    await sql`
      insert into course_enrollments (course_id, student_id)
      values (${COURSE_ID}, ${s.id})
    `;
  }

  // Lesson 3 — The Making of the Working Class (Beat 2).
  const LESSON_ID = "lesson_working_class";
  const blocks = [
    {
      id: "blk_w_context",
      type: "context",
      content: LESSON_CONTEXT,
      meta: "Frame for the student · Beat 2",
    },
    {
      id: "blk_w_hebergam",
      type: "reading",
      content: doc(HEBERGAM),
      meta: "Primary source · 1832 Sadler Committee testimony",
      source: "Parliamentary Papers, House of Commons, 1832 (abridged)",
    },
    {
      id: "blk_w_thompson",
      type: "reading",
      content: doc(THOMPSON),
      meta: "Secondary source · 1963 (condensed)",
      source: "E.P. Thompson, The Making of the English Working Class (1963)",
    },
    {
      id: "blk_w_engels",
      type: "reading",
      content: doc(ENGELS),
      meta: "Counter-source · 1845 (condensed)",
      source:
        "Friedrich Engels, The Condition of the Working Class in England (1845)",
    },
    {
      id: "blk_w_chronology",
      type: "ai_generated",
      content: {
        segment: {
          id: segId(),
          kind: "ai" as const,
          sub_kind: "paragraph" as const,
          body: CHRONOLOGY,
          generation: {
            prompt:
              "Compose a chronology connecting the factory system to the emergence of the English working class, ~1760–1832, suitable as supplementary material for an AP World History lesson on Thompson vs. Engels.",
            model: "claude-sonnet-4-6",
            generated_at: new Date().toISOString(),
          },
        },
      },
      meta:
        "AI-generated · teacher-selected · labeled to students · regeneratable",
      source:
        "E.P. Thompson, The Making of the English Working Class (1963); Eric Hobsbawm, The Age of Revolution (1962); Sidney & Beatrice Webb, History of Trade Unionism (1894); Parliamentary Papers, House of Commons.",
    },
    {
      id: "blk_w_prompt",
      type: "prompt",
      content: LESSON_PROMPT,
      meta: "The lesson's central question",
    },
  ];

  // Teacher notes — private rubric on the response block.
  const teacherNotes = {
    blk_w_response: PRIVATE_RUBRIC,
  };

  await sql`
    insert into lessons (
      id, teacher_id, course_id, title, prompt,
      reasoning_shape, source_material_text,
      expected_kinds, anticipated_gaps,
      blocks, teacher_notes
    )
    values (
      ${LESSON_ID},
      'teacher_k',
      ${COURSE_ID},
      'The Making of the Working Class',
      ${LESSON_PROMPT},
      'Causal historical reasoning. Distinguish economic conditions from political consciousness; expect students to take a position, not hedge.',
      ${HEBERGAM + "\n\n---\n\n" + THOMPSON + "\n\n---\n\n" + ENGELS},
      ${sql.json([
        "conditions claim",
        "consciousness claim",
        "primary-source citation",
        "secondary-source citation",
        "counter-reading engaged",
        "qualified position",
      ])},
      ${sql.json([
        "collapses conditions into consciousness",
        "treats Thompson as self-evidently correct",
        'reads "the working class" as a natural category',
        "ignores Engels rather than arguing with him",
        "hedges instead of taking a position",
      ])},
      ${sql.json(blocks)},
      ${sql.json(teacherNotes)}
    )
  `;

  // Maya's session on Lesson 3 — active, mid-project.
  const SESSION_ID = "session_maya_working_class";
  await sql`
    insert into sessions (id, student_id, lesson_id, status, thread_id)
    values (${SESSION_ID}, 'student_maya', ${LESSON_ID}, 'active', null)
  `;

  // Substrate — what Maya has worked through across her four sessions.
  // n1 (the bare "victims" claim) is superseded by n4 (the qualified
  // Thompson-aligned position); n3 challenges n1; n6 is the open inquiry
  // she's currently sitting with.
  const nodes = [
    {
      id: "n1",
      role: "assertion",
      kind: "naive claim",
      content:
        "The factory took everything from the workers. They were victims of the factory in every sense.",
      status: "superseded",
    },
    {
      id: "n2",
      role: "support",
      kind: "primary-source citation",
      content:
        "Joseph Hebergam (1832): started at 7, 15-hour days, beaten when he slackened, knees permanently bent, brother dead at 14 from the same work.",
      status: "open",
    },
    {
      id: "n3",
      role: "challenge",
      kind: "counter-reading from Thompson",
      content:
        "Thompson: workers MADE THEMSELVES into a class. The factory produced workers, but workers became a class through their meetings, pamphlets, strikes — soil and plant.",
      status: "resolved",
    },
    {
      id: "n4",
      role: "assertion",
      kind: "qualified position",
      content:
        "The working class made itself through political consciousness, building on the material conditions the factory system created. Conditions vs. consciousness — both matter, consciousness is what makes a class.",
      status: "open",
    },
    {
      id: "n5",
      role: "support",
      kind: "secondary-source citation",
      content:
        "The Factory Act of 1833 — passed because workers had organized enough to be heard by Parliament. Conditions alone wouldn't have produced legislation; consciousness did.",
      status: "open",
    },
    {
      id: "n6",
      role: "inquiry",
      kind: "open question — load-bearing",
      content:
        "What does 'made' even mean here? Did the workers wake up one day and decide they were a class? It's gradual. So is it the meetings? The pamphlets? Or just that there were more of them now in cities and they ran into each other? But that's still kind of the factory doing it, just indirectly.",
      status: "open",
    },
    {
      id: "n7",
      role: "inquiry",
      kind: "vocabulary forming",
      content:
        '"Class solidarity vs. class condition." This feels like the distinction. Engels has class condition without consciousness. Thompson has consciousness as what makes a class. Need to take Engels seriously even if I argue against him.',
      status: "open",
    },
  ];
  for (const n of nodes) {
    await sql`
      insert into nodes (id, session_id, role, kind, content, status)
      values (${n.id}, ${SESSION_ID}, ${n.role}, ${n.kind}, ${n.content}, ${n.status})
    `;
  }

  const edges = [
    { id: "e1", src: "n2", dst: "n1", relation: "positive", kind: "supports" },
    {
      id: "e2",
      src: "n3",
      dst: "n1",
      relation: "negative",
      kind: "challenges",
    },
    { id: "e3", src: "n4", dst: "n1", relation: "positive", kind: "refines" },
    { id: "e4", src: "n3", dst: "n4", relation: "depends", kind: "addressed by" },
    { id: "e5", src: "n5", dst: "n4", relation: "positive", kind: "supports" },
    { id: "e6", src: "n6", dst: "n4", relation: "depends", kind: "open under" },
    { id: "e7", src: "n7", dst: "n4", relation: "depends", kind: "open under" },
  ];
  for (const e of edges) {
    await sql`
      insert into edges (id, session_id, src_id, dst_id, relation, kind)
      values (${e.id}, ${SESSION_ID}, ${e.src}, ${e.dst}, ${e.relation}, ${e.kind})
    `;
  }

  // Turns — Maya's think-out-loud across her four sessions. The composed
  // view + next_gap fields stay null in the seed; subsequent live turns
  // populate them via turn_call.
  const turns = [
    {
      id: "turn_maya_1",
      raw_prose:
        "The Hebergam testimony is brutal. Seven years old. His brother died at fourteen. This proves the workers were victims of the factory.",
    },
    {
      id: "turn_maya_2",
      raw_prose:
        "Read Thompson today. The 'soil and plant' thing is sticking with me. He's saying the workers MADE THEMSELVES into a class, which is wild because everything else I've read makes it sound like the factory made them. Need to figure out which one I think is right.",
    },
    {
      id: "turn_maya_3",
      raw_prose:
        "Engels makes the opposite case from Thompson basically. For Engels the workers are products. For Thompson they're agents. Both are looking at roughly the same period. So how do they disagree? I think it's about consciousness — Engels thinks the structure makes the class whether the workers know it or not, Thompson thinks the class only exists once the workers see themselves that way. This feels like class solidarity vs. class condition. Need to think about which one I'm arguing for.",
    },
    {
      id: "turn_maya_4",
      raw_prose:
        "Going back to the draft. I think I'm landing on Thompson but I want to take Engels seriously.",
    },
  ];
  for (const t of turns) {
    await sql`
      insert into turns (id, session_id, raw_prose, composed_view, next_gap)
      values (${t.id}, ${SESSION_ID}, ${t.raw_prose}, null, null)
    `;
  }

  // Composed reading — Maya × Lesson 3 (Beat 9).
  await sql`
    insert into readings (
      id, student_id, lesson_id,
      derived_content, derived_at, derived_from_turn_id,
      teacher_annotations, status
    )
    values (
      'reading_maya_working_class',
      'student_maya',
      ${LESSON_ID},
      ${sql.json(MAYA_READING)},
      now(),
      ${turns[turns.length - 1].id},
      null,
      'fresh'
    )
  `;

  // Two annotations from Mr. Okafor on Maya's reading (Beat 8).
  await sql`
    insert into progression_annotations (
      id, teacher_id, student_id, target_type, target_id,
      excerpt, body, status
    )
    values (
      'ann_okafor_maya_1',
      'teacher_k',
      'student_maya',
      'reading',
      'reading_maya_working_class',
      ${"Victims of what exactly? Just the machines? The owners? The whole system?"},
      ${"This is the right question. Stay with it. The strongest essays in this unit will be the ones that answer it precisely."},
      'open'
    )
  `;
  await sql`
    insert into progression_annotations (
      id, teacher_id, student_id, target_type, target_id,
      excerpt, body, status
    )
    values (
      'ann_okafor_maya_2',
      'teacher_k',
      'student_maya',
      'reading',
      'reading_maya_working_class',
      ${"The economic conditions were the soil, but the class was the plant, and the plant grew itself."},
      ${"You're getting at something real here. Push the Engels reading harder before you commit. What would Engels say about the line \"the plant grew itself\"? He might not buy it."},
      'open'
    )
  `;

  const counts = await sql`
    select
      (select count(*)::int from teachers)                 as teachers,
      (select count(*)::int from students)                 as students,
      (select count(*)::int from users)                    as users,
      (select count(*)::int from courses)                  as courses,
      (select count(*)::int from course_enrollments)       as enrollments,
      (select count(*)::int from lessons)                  as lessons,
      (select count(*)::int from sessions)                 as sessions,
      (select count(*)::int from nodes)                    as nodes,
      (select count(*)::int from edges)                    as edges,
      (select count(*)::int from turns)                    as turns,
      (select count(*)::int from readings)                 as readings,
      (select count(*)::int from artifacts)                as artifacts,
      (select count(*)::int from progression_annotations)  as annotations,
      (select count(*)::int from backboard_scopes)         as backboard_scopes
  `;
  console.log("Seeded counts:", counts[0]);

  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
