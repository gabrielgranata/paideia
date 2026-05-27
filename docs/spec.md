# Paideia — Working Spec

A reasoning-first learning platform built around a single architectural commitment: the LLM may surface observations, questions, and structural prompts, but the inferential moves themselves must remain the student's. This document is the engineering and feature reality of the system as it stands, distilled for competitive analysis and design partnership. It is faithful to the code, not the marketing — including where the implementation has overshot or undershot the project's own stated rules.

---

## 1. Positioning in one paragraph

Paideia is a humanities/argument-discipline classroom platform with two surfaces: a student writing environment that captures reasoning as a structured graph rather than a prose log, and a teacher reading environment that lets one teacher hold thirty students' in-progress thinking legibly across a unit. Between them sits a typed substrate (Postgres) and a small, bounded set of LLM calls whose output schemas are shaped to make conclusion-supply structurally impossible — no `summary`, `answer`, or `recommendation` fields exist anywhere the model can write. The marketed differentiator is not "AI tutor that explains" but "AI surface that refuses to think for you, on purpose, with the schemas to prove it." The product is therefore a deliberate counter-design to the dominant LLM-edtech pattern (chat surfaces, autocomplete, "let me help you write that").

The competitive frame: this is the implementation of the one AI usage pattern that *preserved* learning in Anthropic's Trio study (Shen & Tamkin 2026) — active questioning, no delegation — operationalized as the product's only available pattern. Surrounding tools (Khanmigo, NotebookLM, MagicSchool, ChatGPT-as-tutor) optimize for in-session productivity and felt helpfulness; Paideia explicitly disclaims those and optimizes for off-platform reasoning capacity, accepting in-session friction as evidence that the design is working.

---

## 2. Three layers of binding commitment

In order of bindingness, every design decision is judged against:

1. **Capacity-formation** — Aristotle's *hexis*: reasoning is the activity, and a capacity that is never exercised does not form. A conclusion supplied by the AI is, with respect to the student's reasoning, ontologically empty.
2. **Architecture** — The schemas, pipeline shape, and substrate discipline that make capacity-formation enforceable rather than aspirational. The LLM does not write the substrate; bounded calls emit Zod-validated proposals that deterministic appliers fold into nodes/edges.
3. **Surface** — Microcopy, visual hierarchy, dismissibility. Student writing is the largest, brightest element; AI surfacings are peripheral, non-modal, declinable.

The diagnostic question for any decision is "which layer is this violating?" This is the load-bearing internal phrasing, not a slogan — see the four fidelity tests in §10.

---

## 3. The system, one paragraph

Postgres is ground truth. It holds a per-session reasoning graph (`nodes`, `edges`) plus the student's raw prose (`turns`), the teacher's composed reading of each student (`readings`), across-time progressions (`progressions`), composed artifacts (`artifacts`), teacher invitations (`progression_annotations`), and lesson authoring blocks. Six pipeline-bounded LLM calls plus one chat-shaped call sit on top of this substrate, each with a typed Zod input and output. A small A2UI catalog (five components, locked at the discriminated-union level) is the FFI between LLM-composed prose and the renderer; every rendered sentence cites substrate node IDs, and uncited prose is visually flagged as the drift signal. Backboard (Anthropic's retrieval/memory product) is used per-user as a recall layer, never as source of truth; reads return empty string on failure and writes are fire-and-forget. Frontend is Next.js 16.2 App Router, React 19.2, Zod v4, postgres template-literal driver.

---

## 4. The data substrate

### 4.1 Schema in plain language

| Table | What it holds |
|---|---|
| `users`, `students`, `teachers` | Identity. v0 cookie auth, no password. Exactly one of `teacher_id`/`student_id` set per user. |
| `courses` | A teacher's unit: title, subject, year group, **`arc_seed_text`** (long-form intent the teacher writes once; seeded into every AI surface in the course), cached class summary. |
| `course_enrollments` | Many-to-many. Teacher decides membership. |
| `lessons` | A lesson within a course: prompt, `reasoning_shape`, **`blocks`** (ordered jsonb array, see §4.2), `expected_kinds` and `anticipated_gaps` (jsonb arrays the LLM uses as shaping context), `teacher_notes` (private rubric per block id). |
| `sessions` | A student's active work on a lesson. Status `active`/`completed`. **`working_text`** is a single jsonb of `{notes, draft, reflection}` — three persistent modes in one cell so adding a fourth is render-only. |
| `turns` | Each submit. **`raw_prose` is written before any LLM call** — student input is never lost on LLM failure. Then `composed_view` and `next_gap` are filled in after the pipeline succeeds. |
| `nodes` | The substrate graph: `role ∈ {assertion, support, challenge, inquiry}` (closed), `kind` (open LLM-proposed descriptor, e.g. `"primary-source citation"`), `status ∈ {open, resolved, superseded}`. |
| `edges` | `relation ∈ {positive, negative, depends}` (closed), `kind` (open: `"refines"`, `"challenges"`, etc.). |
| `readings` | Teacher's composed reading of one student × one lesson. `derived_content` = `{resolved, in_progress, unaddressed, recommended_next}`. Status `fresh`/`stale`/`reviewed`. |
| `progressions` | Across-time narrative. Dual scope: `lesson_id` nullable, so the same table holds course-wide and per-lesson progressions. |
| `artifacts` | Generalized composer output. `owner_type ∈ {student, teacher}`, `type` is open (e.g. `study_guide`, `feedback_letter`, `note`), `source_scope` jsonb, `spec_json` holds an A2UI spec or a widget canvas. |
| `progression_annotations` | Teacher's invitations to a student. Anchored to session/turn/reading/artifact. Status `open → received → responded`. Explicitly invitation-shaped: a question only the student can answer from their own thinking. |
| `teacher_chats` | Teacher × lesson conversation history. Structurally walled off — never joins to sessions/turns/nodes (schema comment is explicit). |
| `backboard_scopes` | Cache table mapping `(scope_type, scope_ref_id)` to a Backboard assistant id. Never stores memory ids as FKs. |

The substrate uses one pattern relentlessly: **locked role + open kind**. The closed enum is what queries and dashboards traverse; the open string is the lesson-specific descriptor the LLM produces. Same pattern on edges, artifacts, lesson blocks, widgets.

### 4.2 Lesson block model

A lesson is an ordered array of typed blocks (`block.type` locked to seven values: `context`, `reading`, `video`, `prompt`, `response`, `ai_generated`, `quiz`). The `content` shape varies per type:

- `reading` → `Doc = { segments: Segment[] }` where each segment is `{ kind: "human" | "ai", body: string }`; AI segments carry `sub_kind ∈ {paragraph, chart, diagram}` and **generation metadata** (prompt, model, generated_at) set server-side, never by the LLM.
- `video` → URL + provider + optional transcript + optional ai_summary.
- AI charts carry a `DataSource` discriminated union with three kinds: `teacher_supplied`, `ai_extracted_from_text` (with cited source), `ai_proposed_from_topic` (with a **required `caveat` field**). The Vega-Lite spec is narrowed to four marks (bar, line, point, area) and three encodings via an explicit allowlist — expanding it is an architecture decision.

A migration module handles legacy bare-string content, idempotently, at both seed time and read time. The pattern is "no interpretation, no enrichment" — legacy reading strings become a single human-authored segment with the same text.

### 4.3 Canonical seed (`db/bootstrap.ts`)

`npm run db:reset` is destructive and seeds a single canonical demo:

- **Mr. Okafor** (teacher), **Maya Chen** (student, stage=`developing`, flagged=true), plus four stub classmates spanning emerging→extending.
- One course: *Industrial Revolution & Modernity*, with the long-form arc seed about "industrialization as a set of conditions that produced new forms of political consciousness."
- One lesson, *The Making of the Working Class*, with the central question "Did the Industrial Revolution create the working class, or did the working class create itself?" and three sources (Hebergam testimony, Thompson, Engels) plus an AI-generated chronology.
- A complete Maya substrate on this lesson: **7 nodes** (one superseded), **7 edges**, four raw prose turns, one composed reading, two teacher annotations. The graph captures Maya's move from "victims of the factory" → Thompson-aligned consciousness reading, with the Engels counter-reading explicitly flagged as unaddressed.

The fixtures are the demo. Pre-seeded substrate is intentionally narrow because render paths can't handle arbitrary shapes yet.

### 4.4 The applier

`src/lib/substrate/applier.ts` is the only place node/edge status changes are written. It accepts the LLM's typed `new_nodes` and `new_edges` arrays, allocates real ids, maintains a `tmp_id → real_id` map, inserts. On FK failure (bad ref to a non-existent node), it catches, logs, and continues — one bad edge does not kill the turn. The applier auto-supersedes: if a new edge has relation `positive` and kind contains `"refin"`, `"qualif"`, or `"supersed"`, and the destination is an existing open assertion, the destination's status flips to `superseded`. This preserves history without polluting "currently held" queries.

---

## 5. The LLM pipeline

The CLAUDE.md claims "five fixed calls." The actual implementation has **seven bounded calls**. Six are pipeline-shaped (typed input, typed output, no free-form conclusion fields); one is chat-shaped but constrained.

| # | Call | Where | Touches substrate? | Output shape |
|---|---|---|---|---|
| 1 | `turn_call` | Student submits in lesson | Yes (writes nodes/edges) | `new_nodes[]`, `new_edges[]`, optional `composed_view` (sentences with cites), `next_gap` (closed `move_type` enum + target_node_ids + prompt_to_student) |
| 2 | `reading_compose` | Teacher refreshes a student's reading | Reads substrate | `{resolved, in_progress, unaddressed, recommended_next}` |
| 3 | `progression_compose` | Student or teacher refreshes progression | Reads readings | `{prior_state, inflection_moment, current_state, recommended_next}` each with anchored lesson lists |
| 4 | `artifact_compose` | Student composes study guide / presentation / test prep | Reads substrate + readings | A2UI spec: sections with cited body and `open_questions`; `meta_questions[]` |
| 5 | `class_summary_compose` | Teacher refreshes dashboard | Reads cohort readings | `{summary, recurring_pattern}` |
| 6 | `lesson_content_compose` | Teacher uses Generate Panel | Does not touch student substrate | One typed AI segment (paragraph / chart / diagram) with mandatory provenance |
| 7 | `teacher_lesson_chat` | Teacher chat panel while authoring | Does not touch student substrate | `{reply, suggested_action?}` where `suggested_action` is a closed discriminated union (insert_ai_generated / insert_context / insert_prompt); LLM cannot invent action kinds |

Model used everywhere: `claude-sonnet-4-6`. Max tokens range 1024 (class summary) to 3072 (turn / artifact / lesson content).

The observational-not-declarative voice is enforced *in prompts and reinforced by schemas*. Representative line from `turn-call.ts`:

> Your job is to make the student's reasoning legible — to read it back, to surface structural defects, to ask questions that force the student to make the next inferential move themselves. You NEVER supply conclusions. You NEVER complete the student's thought.

And from `lesson-content-composer.ts` on chart captions:

> Describe what the figure shows, never what the student should conclude from it. "Wheat prices, 1780–1789" — yes. "Wheat prices, which caused the Revolution" — never.

The structural enforcement is that no schema in the system has a free-form `summary` / `answer` / `recommendation` / `reasoning` field. Wherever the LLM has prose latitude (the `reply` in teacher chat; the section bodies in artifacts), the prose must be quoted/paraphrased from substrate that was passed in. Citations or substrate references are required in every composer output.

---

## 6. A2UI — the FFI between LLM and renderer

`src/lib/a2ui/spec.ts` exposes a Zod discriminated union locked at **five component types**:

- **ComposedNarrative** — prose with per-sentence citations
- **QuestionPrompt** — system inquiry (italic serif, no panel)
- **ArtifactCard** — navigation chip to an artifact page
- **ArtifactGrid** — 3-col grid of cards
- **SourceReference** — inline pill with ↗ expand

`parseA2UISpec()` validates beyond Zod: unique component ids, every `root_id` resolves, every `ArtifactGrid.card_ids` entry points at an `ArtifactCard`. The renderer (`Renderer.tsx`) re-validates at the boundary and dispatches via an exhaustive switch — TS exhaustiveness will catch any missing case if the union is widened.

The "extra" components in `src/components/a2ui/` are **layout shell, not catalog members**: `Chrome` (top bar), `MainColumn` (student writing surface, cream background), `MarginPanel` (left margin for AI surfacings), `ColLabel` and `MLabel` (section labels). The boundary discipline encoded in `MainColumn.tsx`: no AI element is a direct child of MainColumn except `QuestionPrompt` (the prompt the student answers). All other AI prose (ComposedNarrative, Context) lives in MarginPanel.

### 6.1 Citation discipline = drift signal

`Sentence.cites: string[]` references substrate node IDs. `ComposedNarrative` renders cited sentences with a superscript (`[3]`, with `title` attribute exposing the node ids on hover) and meta-prose (empty `cites`) as italic + dimmed. This is non-decorative: **uncited prose is the visible signal that the system performed reasoning the substrate does not support**. The renderer makes the failure mode legible rather than hiding it.

### 6.2 Widgets (separate FFI)

`src/lib/widgets/schemas.ts` is a *parallel* authoring system, not part of A2UI. Widgets stack on a canvas (Notion-style notes) and can be student-authored (`text`, `quote`, `source_ref`, `divider`) or AI-authored (`ai_observation` only, with required `generation` metadata). Each widget carries `authored_by ∈ {student, ai}` — forgery is structurally prevented. A2UI is AI-emitted; widgets are the student authoring surface; lesson blocks are the teacher authoring surface. Three FFI boundaries, never mixed.

---

## 7. Backboard — retrieval, not truth

Backboard is an Anthropic-internal retrieval/memory product. Paideia uses it with strict discipline:

- **One assistant per scope.** Naming convention `paideia-{student|lesson|teacher}-{id}`. Per-user isolation is enforced by per-assistant. Three scope kinds → three system prompts, each scoped (student profile, lesson shared docs, teacher cross-class notes).
- **Resolution chain:** `backboard_scopes` cache → `listAssistants()` name lookup → `createAssistant()`. Cache upsert on every successful path.
- **Writes are fire-and-forget.** All write functions are `void`-callable, errors caught and logged, never thrown. Backboard outage cannot break the request loop.
- **Reads are one-shot `Readonly` threads** that return empty string on any failure. Callers proceed without the extra context.
- **Distinct API quirks:** `X-API-Key` header (not Bearer); `addMessage` uses form-data not JSON; memory ops use uppercase status (`COMPLETED|PROCESSING|FAILED`); document indexing uses lowercase (`indexed|error`).
- **Never source of truth.** Memory ids are immutable; updating means delete + add (id changes), so they are never stored as Postgres FKs. If Backboard contradicts Postgres, Postgres wins.

Four write call-sites, two read call-sites:

| Writes | Where |
|---|---|
| `writeStudentReadingMemory` | After each turn, after progression compose, after artifact compose |
| `writeLessonReading` | After teacher composes a reading (cohort-readable per-lesson assistant) |
| `writeTeacherNote` | After teacher submits annotation, after class summary |
| `writeCohortPattern` | Defined; not yet wired |

| Reads | Where |
|---|---|
| `retrieveStudentMemory` | turn-call, student progression compose, student artifact compose, teacher progression compose |
| `retrieveLessonContext` | turn-call only (RAG over lesson source docs) |

The student-facing memory page (`/memory`) and the teacher memory page (`/teacher/memory`) are read-only listings of accumulated memories with type chips and timestamps. They render an explicit error state if Backboard is unreachable: *"Memory layer is currently unreachable. Your work is safe — Postgres holds the ground truth — but the long-horizon profile can't be read right now."*

---

## 8. User-facing surfaces

### 8.1 Student

| Surface | What's there |
|---|---|
| `/login`, `/signup` | Cookie-only auth (v0). Login is a profile picker. Signup creates the student row, user row, and per-student backboard scope. |
| `/courses` | Catalog of courses with enroll button. |
| `/lesson/[session_id]` | **The session loop.** Three columns: left rail with materials (readings, video, quiz, AI-generated chronology); center with `QuestionPrompt` + the writing surface (Notes / Draft / Reflection modes, autosaved ~2.5s idle); right rail (`AnnotationsRail`) with chronological AI observations, peripheral and non-modal. Submit fires `submitTurn`: raw_prose written first, then turn_call runs, then applier folds in the delta, then `next_gap` lands in the rail. |
| `/portfolio` | Timeline sidebar of sessions; sidebar "Development" summary with refresh button calling `progression_compose` at course scope. |
| `/progression/[student_id]` | Full four-move progression view (Earlier / The shift / Now / What the system observes next), each move anchored to lesson titles. Students can view their own; teachers can view any of theirs. |
| `/artifacts` | Home: sessions in progress, sessions complete, available lessons, composed artifacts (with composing/ready/failed states), notes (widget canvases). |
| `/artifacts/new` | Composer: intent picker (study_guide / presentation / test_prep), multi-lesson selector (only lessons with substrate are eligible — no summarizing unseen material), fires `artifact_compose`. |
| `/artifacts/[id]` | For composed artifacts: cited sections, open questions, meta questions, mandatory "Composed by system" label. For notes: inline-editable canvas of widgets. |
| `/memory` | Read-only list of backboard memories with type chips. |

The session loop is the heart of the product. The writing surface is large, in EB Garamond, cream background. The AI surfaces are smaller, in the margin, dismissible. Critically: **there is no "help me write this," no autocomplete, no chat box, no paste-back-from-AI affordance on the student surface, and no feature in the codebase that could be wired to add one without coordinated schema and renderer changes.** This is enforced by the catalog being locked and the writing surface being hand-built React with no AI props.

### 8.2 Teacher

| Surface | What's there |
|---|---|
| `/teacher` | Class dashboard. Filter bar by stage (emerging/developing/proficient/extending/IE) and flagged. Class summary at top (refreshable). Student grid with stage chips and summaries. |
| `/teacher/student/[student_id]` | Three columns: roster sidebar; middle shows the student's current position pulled from their reading; right shows AI observations (resolved/in_progress/unaddressed) with refresh, prior annotations, and a prompt-to-student form that creates a `progression_annotation`. |
| `/teacher/lessons` | List of teacher's lessons. |
| `/teacher/lessons/new` | Skeleton creation: title + central question + optional context → drops into editor. |
| `/teacher/lessons/[id]/edit` | Plan View. Sortable block list, per-block private teacher notes, Reading Doc Editor (TipTap) with **Generate Panel** for paragraph/chart/diagram (each with non-dismissible provenance footer and "Show data" disclosure for charts). ChatPanel on the right calling `teacher_lesson_chat`; suggested actions surface with one-click Apply (no silent edits — teacher remains the author). Preview Mode toggle renders student view with private notes side-marked. |
| `/teacher/memory` | Read-only memory listing for teacher's persistent assistant. |

The teacher view is a reflection-on-action surface in the Schön sense: it aggregates substrate so one teacher can hold thirty students legibly without grading the prose. The annotation form's microcopy explicitly says *"A question the student can only answer from inside their own thinking."* It is not a comment box; it is invitation-shaped, with a status lifecycle (open → received → responded).

### 8.3 System

- One API route: `POST /api/teacher/generate-segment` (auth-gated to teachers, calls `lesson_content_compose`, returns a typed segment for the client-side TipTap editor to insert; no DB write here — save is client-owned to avoid persisting draft iterations).
- Server actions split across `actions/{auth,student,teacher,turn}.ts`. Pattern: read state → optional backboard read (best-effort) → typed LLM call → applier or upsert → optional backboard write (fire-and-forget) → `revalidatePath`.

---

## 9. Non-negotiables, with structural enforcement

| Rule | How it's enforced |
|---|---|
| LLM never writes the substrate directly | Bounded calls return Zod proposals; only `applier.ts` writes nodes/edges. |
| Pipeline, not agent | Six fixed pipeline calls + one constrained chat call. No agent loop anywhere. Each call rebuilds context from substrate; conversation history is not source of truth. |
| No free-form completion fields in any LLM output | Audited: zero schemas in `src/lib/llm/` have a `summary`/`answer`/`recommendation`/`reasoning` field. Where prose is allowed, citations are required. |
| Every composed sentence cites substrate | `Sentence.cites: string[]`; `ComposedNarrative` flags empty cites visually as the drift signal. |
| Voice is observational and structural | Enforced in prompts; reinforced by the absence of evaluative fields in schemas. |
| Memory informs next question, never authors content | Backboard reads feed prompt context; reads return `""` on failure and the pipeline degrades gracefully. |
| Postgres is ground truth | Backboard ids never stored as Postgres FKs. Reads/writes are best-effort overlays. |
| Student writing is the foreground | A2UI `MainColumn` accepts only `QuestionPrompt` as an AI child; all other AI prose lives in `MarginPanel`. |
| No completion affordances on the student surface | No autocomplete, no chat, no "help me write this" in the codebase. The hand-built student React imports nothing from the A2UI renderer. |
| AI-emitted UI = A2UI catalog; student-authoring UI = hand-built React | Two distinct module trees that do not cross-import. |
| Provenance preserved at the move level | Every AI segment carries server-set `generation: {prompt, model, generated_at}`. Widgets carry `authored_by`. Artifacts carry source scope. |
| Cohort visibility is structural-only by default | Cohort-readable backboard assistants store readings (the composed prose layer), not raw substrate; teacher dashboard shows stage chips and patterns, not other students' prose. |

---

## 10. Four fidelity tests

Applied to any new feature before it ships:

1. **Next-move test.** After this interaction, who made the next inferential move — the student or the system?
2. **Trace test.** Does the interaction leave a typed, queryable trace in the substrate?
3. **Recede test.** During use, does the AI surface remain peripheral, or does the student have to leave the writing to interact with it?
4. **Off-platform test.** Would a student who worked this way for a semester reason better, the same, or worse than a peer who did not use Paideia?

The fourth is the only one that ultimately matters and the one most current AI-edtech tools fail.

---

## 11. Divergence between aspiration (CLAUDE.md) and reality

Worth flagging for accurate competitive positioning:

- **"Five fixed calls" is an undercount.** Real implementation has seven (six pipeline + one chat). The chat call (`teacher_lesson_chat`) is the most interesting drift candidate: it's authoring-side, never touches student substrate, but its `reply` field is free-form prose with no citation requirement. Discipline is enforced by prompt only on this surface, which is the weakest enforcement mode in the system.
- **"Catalog locked at 5 components" is accurate**, but the layout shell (`Chrome`, `MainColumn`, `MarginPanel`, `ColLabel`, `MLabel`) is in the same directory and reads at first glance like additional catalog entries.
- **Widgets and lesson blocks are separate FFIs**, not mentioned in CLAUDE.md's "A2UI is the FFI" claim. The actual story is three FFIs: A2UI (AI emits to renderer), widgets (student composes canvas, AI can drop in `ai_observation` only), lesson blocks (teacher authors with Doc/segment substructure for AI augmentation).
- **Video blocks exist** in the lesson block enum but there is no separate video table — video is inline in `blocks.content`. There is a `VideoPlayer` component but no transcript pipeline yet.
- **`progression_annotations.target_id` is not FK-constrained** because target_type varies (session/turn/reading/artifact). This is a known schema soft spot for v0.
- **Auth is hackathon-only** (cookie carries the principal; no password). Must be replaced before production.
- **`students.stage` and `students.summary` are denormalized** for dashboard performance. Schema comment acknowledges these should derive from substrate + readings in production; the current denorm is a known v0 shortcut.
- **`/progression` route is implemented**, contradicting the demo script's note that it 404s. The route exists, but UX-wise it requires at least one reading to compose.

---

## 12. Empirical anchors

The product cites these as the evidentiary load-bearing studies; useful for competitive analysis because few competitors engage with them:

- **Kosmyna et al., MIT, 2025** (arXiv 2506.08872) — EEG study, N=54: LLM-condition writers showed weakest distributed brain connectivity and could not quote essays they had just submitted; "cognitive debt" framing.
- **Shen & Tamkin, Anthropic, 2026** (arXiv 2601.20245) — RCT, N=52 engineers: AI users 17% lower on comprehension (≈2 letter grades), gap widest on debugging; the engaged-questioning pattern (≈80% of AI users) preserved learning; delegation (≈20%) produced the deficit. The single most direct A/B test of Paideia's design.
- **Becker et al., METR, 2025** (arXiv 2507.09089) — RCT, N=16 senior devs: forecast 24% speedup, perceived 20% speedup, measured 19% *slowdown*. Perception ≠ reality, so the substrate must not rely on student self-report as a quality signal.
- **Gerlich, 2025** (Societies 15(1):6) — N=666: negative correlation between AI use and critical thinking, mediated by cognitive offloading.
- **Twardy 2004 / van Gelder** — argument mapping in critical-thinking interventions: effect sizes ~0.8 SD, largest documented intervention in the educational literature. **The substrate is an argument map** in this technical sense; this is the empirical hook for the typed-graph differentiator vs. note/chat surfaces.
- **DORA 2024** — team-level throughput and delivery stability decline with individual AI adoption even as individual satisfaction rises; reinforces the perception/outcome gap.

---

## 13. Open tensions (the honest ones)

These are unresolved and should be visible in any competitive comparison:

- **Productive resistance vs. demo legibility.** Friction is doing the pedagogical work, but in a five-minute first impression friction reads as defect. The demo must make legible *what* the friction is doing, not ask the audience to take it on faith.
- **LLM interpretive latitude vs. pipeline discipline.** Tighter prompts and schemas reduce the model's ability to occasionally drift into supplying a move, at the cost of flexibility and naturalness. The codebase errs hard toward pipeline. The teacher chat is the one place this discipline is loosest.
- **Whose graph is the learning artifact?** The schema is the system's; the moves and content are the student's; the inflections are co-produced. Ownership for assessment, portability, and privacy is unresolved.
- **Teacher labor.** Paideia is unscalable if it requires per-student-per-document teacher engagement to function. The substrate must aggregate labor (stage chips, class summary, recurring-pattern surfacing) without automating the meaning-making — a constant tension.
- **Bounds of competence.** Argument-heavy disciplines (philosophy, history, literary analysis, social sciences, parts of mathematics) are core. Clinical judgment, craft, embodied performance are not — or are at most peripheral. Polanyi's somatic tacit knowledge is out of scope, and the platform should be honest about that.
- **Self-routing around the substrate.** If students paste prompts into external chatbots and bring conclusions back, the architectural defense has failed. The current response is *teacher-visible provenance* (every AI-generated segment carries `generation` metadata); the open question is whether that's sufficient at scale.

---

## 14. Competitive sketch

Compared to the dominant AI-edtech designs:

| Pattern | Default tool | Paideia |
|---|---|---|
| Conversational tutor (Khanmigo, ChatGPT, MagicSchool chat) | Chat surface, agent loop, AI explains and "Socratically" guides | No chat on student surface. Six bounded calls, no agent. The AI surfaces structural questions; explanations are explicitly forbidden. |
| Research/summary tool (NotebookLM, Perplexity) | AI synthesizes source material, produces a summary or podcast | The composer never invents content; sections must quote/paraphrase substrate the student authored; "Composed by system" is mandatory provenance. |
| Writing assistant (Grammarly, Copilot for Docs, Lex) | Autocomplete, polish, suggest | No completion affordances exist. The writing surface is hand-built React with no AI props; the catalog is locked. |
| Learning analytics dashboards (Knewton, etc.) | Metric grids, mastery scores | Stage chips + recurring-pattern paragraph + per-student reading composed from the actual substrate; no scoring, no leaderboards. |
| Argument-mapping tools (Rationale, Kialo, MindMup) | Manual graph construction by student | Graph is built by `applier` from LLM-typed proposals on student prose; student writes prose, the structure emerges. Much lower friction than manual mapping; same Twardy/van Gelder pedagogical mechanism. |

The single defensible differentiator is the combination: *typed reasoning graph as substrate + LLM constrained at the schema level to never supply conclusions + composer outputs that must cite that substrate*. None of the dominant tools have all three. Most have none.

---

## 15. Tech stack, for completeness

- **Next.js 16.2** App Router (breaking changes from older Next; consult `node_modules/next/dist/docs/`)
- **React 19.2**
- **Zod v4** (not v3 — different API for discriminated unions)
- **`postgres` 3.4** template-literal driver, single connection stashed on `globalThis` to survive Next.js dev HMR
- **Anthropic SDK** with model `claude-sonnet-4-6` everywhere
- **TipTap** for the teacher reading doc editor
- **react-vega** for live chart rendering from the narrow Vega-Lite allowlist
- **Backboard** (Anthropic-internal) for retrieval/memory
- **Postgres 16** (docker, port 5433)
- No tests, no lint, no typecheck script wired in `package.json`; `tsc --noEmit` works but isn't automated
- TS path alias `@/* → src/*`

---

## 16. What this document is not

It is not the philosophy doc (`philosophy.md` — 190 lines, the full theoretical brief from Aristotle through Vallor; load that if competitive analysis touches the philosophical lineage). It is not the demo script (`demo/script.md`, `demo/voice-script.md` — the 20-beat copy-paste-ready walkthrough and the ElevenLabs narrator pass). It is not a roadmap; near-term build items live in `demo/build-prompts.md` as F1–F15 (engage/dismiss states on observations, sentence-level anchors, widget palette, cross-document comparison surface, etc.).

For competitive brainstorming, the three documents to load are: this spec, `philosophy.md` for the theoretical depth, and `demo/script.md` for the canonical product narrative.
