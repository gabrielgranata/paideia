# Build prompts — bringing the app up to the demo script

Each prompt below is self-contained. Paste it into a fresh Claude Code session at `/Users/gabriel/workplace/paideia` (or as the input to a spawned `Agent`). The agent reads the listed files, builds the feature, and runs `/paideia-fidelity-check` before claiming done.

The **Preamble** below applies to every feature — paste it once at the top of any prompt that lacks it. The per-feature briefs then stay short.

---

## Preamble — paste before every feature prompt

```
Working directory: /Users/gabriel/workplace/paideia.

Required reading before writing code:
- CLAUDE.md (project discipline)
- AGENTS.md (Next.js 16 differs from your training data; check node_modules/next/dist/docs/ for anything unfamiliar)
- philosophy.md (the four fidelity tests are non-negotiable)
- db/schema.sql (substrate primitives + locked-role / open-kind idiom)

Invoke skills:
- /paideia-component before designing any UI surface
- /paideia-prompt before authoring any LLM prompt
- /paideia-fidelity-check before claiming the feature is done

Universal rules:
- No completion affordances on student surfaces — no "help me write this", no autocomplete finishing a thought, no "AI fill" anywhere.
- Locked role + open kind on substrate, unless a feature explicitly locks kind.
- LLM I/O is always Zod-validated. No free-form completion fields in schemas.
- Postgres is ground truth. Backboard is retrieval-only; if they disagree, Postgres wins.
- Pipeline, not agent. Bounded calls with typed inputs and outputs.

When done: small focused commit, run /paideia-fidelity-check, return.
```

---

## Tier 1 — Student-side reasoning surfaces

### F1 — Widget palette in the writing surface

```
Build the student writing surface widget palette.

Read: src/app/lesson/[session_id]/page.tsx, src/components/lesson/ExploreSurface.tsx, src/components/lesson/AnnotationsRail.tsx, db/schema.sql (nodes + edges).

Catalog (LOCKED at four — do not extend without architectural sign-off):
- Citation (source + anchor excerpt)
- Claim-with-Support (claim filled, Support stays visibly empty until typed)
- Counter-Argument (position, counter, response stays visibly empty until typed)
- Comparison (passage A, passage B, what's different)

Sidebar palette in the Draft mode. Drag or click-to-insert at cursor. Each insertion creates a substrate node (role ∈ assertion | support | inquiry; kind ∈ those four — kind LOCKED here). Anchor data (paragraph_id or sentence excerpt) lives on a related edge, not in JSON inside nodes.content. Persist as plain text — render shape comes from the widget component, not from re-parsing content.

Add server action: createWidget(sessionId, kind, fields, anchor).

Done when: each widget inserts, saves, survives reload, renders inline in the Draft, and is visible in the teacher's student-detail view. Empty fields are visibly empty.
```

### F2 — Engage / Dismiss state on AI observations

```
Add engage/dismiss state to AI observations in AnnotationsRail.

Read: src/components/lesson/AnnotationsRail.tsx, src/app/lesson/[session_id]/page.tsx, src/lib/llm/turn-call.ts, src/app/actions/turn.ts, db/schema.sql.

Current state: AnnotationsRail lists turns.next_gap chronologically; no per-observation state.

Per observation, add state ∈ {fresh, engaged, dismissed}. Engage records a timestamp. Dismiss requires a free-text reason that's preserved indefinitely (never overwritten). Schema: extend turns or add an observations table referencing turns — your call, document the choice.

UI: Engage / Dismiss buttons on each card. Engaged → subtle state badge. Dismissed → faded card with the reason visible inline. Fresh → current presentation.

Server actions: engageObservation(turnId), dismissObservation(turnId, reason).

The teacher's /teacher/student/[id] view must reflect state (e.g. "Maya dismissed: <reason>").

Done when: state survives reload, dismiss requires a reason, dismissed observations are never lost, teacher view shows state.
```

### F3 — Cross-document observation surface

```
Build the cross-document observation surface in the student lesson view.

Read: src/components/lesson/AnnotationsRail.tsx, src/app/lesson/[session_id]/page.tsx, src/lib/llm/turn-call.ts.

Some observations anchor across two surfaces — e.g., a phrase that appears in Notes but is missing from Draft. When such an observation is Engaged (F2), surface a side-by-side comparison view of the two passages. Style mirrors the Comparison widget (F1).

Requires: observation anchors are structured, with kind ∈ {paragraph, sentence, cross_document} and target_refs[] — see F4 below.

Cross-document view: opens inline in the writing surface (not modal). Left = source A excerpt. Right = source B excerpt or "not found in <B>". A single text input below for the student to write a response, which becomes a turn.

Done when: a cross-document observation can be Engaged → side-by-side view opens → student types → submitting creates a turn that records both the engagement and the response.
```

### F4 — Sentence / paragraph anchors on observations

```
Add structured anchor data to AI observations.

Read: src/lib/llm/turn-call.ts, src/app/actions/turn.ts, db/schema.sql (turns + next_gap shape).

Currently turns.next_gap is { prompt, target_node_ids, type }. Extend the next_gap schema:
- anchor_kind ∈ {paragraph, sentence, cross_document, note, draft}
- anchor_refs: a typed array (paragraph_id + optional sentence excerpt for sentence anchors; note_id + draft_paragraph_id for cross_document).

Update turn-call.ts so its Zod schema enforces this shape and the LLM prompt asks the model to emit anchors. Anchors must point at substrate that exists — validate before persisting.

The renderer (AnnotationsRail + the writing surface) uses anchors to highlight where the observation points: a subtle underline on the targeted sentence, a margin marker for paragraph anchors, a cross-document chip for cross-document anchors.

Done when: every new observation carries valid anchor data, the renderer highlights the target, F3's cross-document surface can rely on the anchor type.
```

---

## Tier 2 — Teacher-side surfaces

### F5 — Refresh trigger on the composed teacher's reading

```
Add a Refresh affordance to the composed teacher's reading.

Read: src/app/teacher/student/[student_id]/page.tsx, src/app/actions/teacher.ts (composeReading), src/lib/llm/reading-composer.ts.

composeReading server action exists. The reading page currently reads a stale readings row.

Add: a Refresh button on the reading panel. On click → invokes composeReading(student_id, lesson_id) → revalidates the path → new four-part reading renders. Show a small "Composing…" state while the call is in flight. Failure: keep the prior reading visible with a "Refresh failed" toast.

The reading lifecycle column on readings.status (fresh | stale | reviewed) should reflect the action — composing sets fresh; teacher annotation submission sets reviewed.

Done when: Mr. Okafor clicks Refresh, sees a new reading composed from current substrate, the status column updates.
```

### F6 — Class-summary composer wired to the dashboard

```
Replace the hardcoded class summary in /teacher with a composed one.

Read: src/app/teacher/page.tsx (hardcoded class summary copy), src/app/actions/teacher.ts (composeClassSummary), src/lib/llm/class-summary-composer.ts, db/schema.sql.

Currently the class summary at the top of /teacher is hardcoded copy in the page component. Swap for a database read of the most recent composed class summary for the active course, with a Refresh button that calls composeClassSummary(course_id).

Schema: if there's no class_summaries table, add one — { id, course_id, composed_at, content jsonb, status }. Or stash on courses if a single row per course is enough.

Done when: Mr. Okafor clicks Refresh on the class summary, composeClassSummary runs against the cohort substrate, the new summary persists and renders on the dashboard, prior summaries remain auditable.
```

### F7 — Progression view route

```
Build the /progression route.

Read: src/app/actions/student.ts (composeProgression), src/lib/llm/progression-composer.ts, db/schema.sql (progressions table).

composeProgression exists; progressions table exists; the route 404s.

Build /progression/[student_id]/[lesson_id] (or whatever path matches the demo arc). Page reads the most recent progressions row for the (student, lesson) pair and renders the across-time narrative. A Refresh button invokes composeProgression to regenerate.

Both teacher and student should be able to view their own progression (gate via requireRole / ownership check). Teacher view: drill-down from /teacher/student/[id]. Student view: from /artifacts.

Done when: progression composes, persists, renders, refreshes, and both teacher and student can view it on the appropriate paths.
```

### F8 — Lesson editor Preview Mode polish

```
Polish the Preview Mode toggle on the lesson editor.

Read: src/app/teacher/lessons/[lesson_id]/edit/page.tsx, src/app/lesson/[session_id]/page.tsx, src/components/teacher/Block.tsx.

The `?mode=preview` switch partially exists. Finish it.

Preview Mode requirements:
- Middle column renders the student-facing lesson exactly as /lesson/[session_id] would — same MaterialsRail, same QuestionPrompt, same response surface (empty, not Maya's data).
- Right column shows the teacher's private notes per block in a "Not visible to student" callout.
- A single visible toggle (Plan View ↔ Preview) at the top, with the active mode highlighted.

Constraint: zero divergence between Preview and the actual student render. If the student view changes, Preview changes. Use the same render path where possible.

Done when: toggle works in one click, Preview matches /lesson byte-for-byte (minus the per-student state), and teacher notes show on the right side only in Preview mode.
```

---

## Tier 3 — AI authoring surfaces

### F9 — ChatPanel suggested-action wiring

```
Confirm and polish the ChatPanel's suggested-action round-trip.

Read: src/components/teacher/ChatPanel.tsx, src/app/actions/teacher.ts (sendChatMessage, applyChatSuggestedAction), src/lib/llm/teacher-lesson-chat.ts.

Goal: AI replies in the chat can include a structured suggested_action (e.g., create_block, regenerate_segment). The teacher sees a one-click Apply affordance; click → applyChatSuggestedAction runs → the lesson editor revalidates → the new block appears in the Plan View.

Verify: the Zod schema for suggested_action is locked (no free-form action types), the applier is deterministic, prior suggested actions remain visible in the chat history with their applied/unapplied state, applying twice is idempotent.

Done when: end-to-end test passes — teacher types "add a reading block on Engels", AI replies with a suggestion, teacher clicks Apply, block appears in the lesson editor with appropriate prefilled content for the teacher to refine.
```

### F10 — Reading Doc Editor — three Generate sub-kinds end-to-end

```
Polish the Generate panel in the Reading Doc Editor so all three sub-kinds round-trip cleanly.

Read: src/components/teacher/reading-editor/GeneratePanel.tsx, src/components/teacher/reading-editor/AIParagraphView.tsx, src/components/teacher/reading-editor/ChartSegmentView.tsx, src/components/teacher/reading-editor/DiagramSegmentView.tsx, src/lib/llm/lesson-content-composer.ts, src/lib/lesson-blocks.ts.

Three sub-kinds: paragraph, chart, diagram.

For each, verify and polish:
- Prompt input → composer call → segment inserted at cursor.
- Provenance footer always rendered (teacher_supplied | ai_extracted_from_text | ai_proposed_from_topic).
- For chart: Vega-Lite spec renders via react-vega; "Show data" disclosure works.
- For diagram: confirm the rendering path is wired (mermaid? SVG?) — document what the diagram pipeline emits.
- For paragraph: confirm citation footer if material_id is set.

Caveat banner mandatory on ai_proposed_from_topic for chart and paragraph.

Done when: a teacher in the Reading Doc Editor can ask for each of the three sub-kinds and a clean segment lands at the cursor with provenance footer visible.
```

### F11 — Chart provenance footer always visible

```
Ensure the chart-segment provenance footer renders on every chart.

Read: src/components/teacher/reading-editor/ChartSegmentView.tsx, src/lib/lesson-blocks.ts (AIChartSegment type).

Constraint: every chart on every surface (Reading Doc Editor authoring, student-facing reading render, any future surface) renders its provenance footer. No way to hide it. ai_proposed_from_topic gets an inline caveat banner that's also non-dismissible.

The "Show data" disclosure must be present (the audit affordance the philosophy requires — every AI-generated visualization is queryable for its underlying data).

Done when: there is no rendering path that surfaces a chart without provenance. Add a small test if testing infra exists; otherwise document the surfaces audited.
```

---

## Tier 4 — Polish and clarity

### F12 — Reflection mode visible affordance

```
Surface the Reflection writing mode in the student lesson page.

Read: src/app/lesson/[session_id]/page.tsx, src/components/lesson/ExploreSurface.tsx, src/app/actions/turn.ts (saveWorkingText).

sessions.working_text persists three modes — { notes, draft, reflection }. Notes and Draft are visible; confirm Reflection has its own affordance.

Reflection should be a distinct mode toggle alongside Notes / Draft, with its own copy framing: "What did you learn? What's still open?" or similar (use /paideia-component for the microcopy). Pure prose surface; not a separate widget.

Done when: a student can switch to Reflection mode, type, save, and see their reflection persist across reloads. The mode is clearly labeled and distinct from Notes.
```

### F13 — Material dwell tracking

```
Track material open + dwell as substrate events.

Read: src/components/lesson/MaterialsRail.tsx, src/app/actions/turn.ts, db/schema.sql.

When a student opens a material (clicks to expand in the rail) and dwells for >N seconds, persist an event so the composed reading can cite "Maya read Engels for 8 minutes."

Storage: a lightweight events table OR a node with role=inquiry kind=material_read on the session. Either way the reading-composer needs to be able to query "what materials did this student read, when, and for how long."

Privacy note: don't track keystroke timing or anything else that could feel surveillant. Open + dwell only.

Done when: opening a material and reading it for some time produces a queryable substrate record; reading-composer prompt context can be extended to include this signal.
```

### F14 — Annotation lifecycle visible to the student

```
Surface the progression_annotations.status lifecycle on the student side.

Read: db/schema.sql (progression_annotations), src/app/actions/teacher.ts (submitAnnotation), src/app/lesson/[session_id]/page.tsx, src/app/portfolio/page.tsx.

The status enum is {open, received, responded}. Wire the transitions:
- open → received when the student first loads a page that displays this annotation
- received → responded when the student submits a turn anchored to the annotation (e.g., a Reflection mode entry that references it)

Student-facing UI: a new annotation lights up on the student's home / portfolio (open). Once they open it (received), the light dims. Once they respond (responded), a visible "responded" mark.

Done when: lifecycle transitions are automatic on the student side, the teacher's student-detail view shows status correctly, and a "responded" annotation links to the responding turn.
```

### F15 — Destructive-action confirms

```
Add confirmation steps to destructive teacher actions.

Read: src/components/teacher/DeleteLessonButton.tsx, src/app/actions/teacher.ts (deleteLesson, deleteBlock, reorderBlock).

Today deleteLesson and deleteBlock can fire without confirmation. Add a confirmation step — small inline confirm (not a browser native dialog) that asks "Delete this lesson? This removes the lesson and all student sessions on it."

reorderBlock is non-destructive but easy to misclick — confirm if drag-distance is below some threshold? Not blocking, just a one-step undo affordance.

Done when: a misclick on Delete doesn't lose work. Single undo or explicit confirm for each destructive path.
```

---

## Suggested run order

If you want this to roll up cleanly:

- **Pass A (parallelizable):** F4 first (anchors are foundational), then F1 + F2 + F3 together once anchors land.
- **Pass B (parallelizable):** F5 + F6 + F7 — three independent Refresh-triggered composer surfaces.
- **Pass C:** F8 + F9 + F10 + F11 — authoring polish. F10 is the standout demo move (chart generation with provenance).
- **Pass D:** F12 + F13 + F14 + F15 — small wins.

Tell me if you want any of these prompts widened, narrowed, or split.
