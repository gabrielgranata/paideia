# Block-Editor Revamp — One Familiar Editor, Role-Scoped

**Date:** 2026-07-18
**Status:** Design approved in direction; four open questions pending (see end).
**Prototypes:** https://claude.ai/code/artifact/9316deff-2b92-4041-a212-a780dae6ad8b (rev 2, "notion-idiom")

## Decision

Extend the reading editor's block grammar to the entire product — the teacher's
lesson composer and the student's session — carried in a **familiar
Notion-style idiom**, not the manuscript/parchment costume (rev 1, rejected).

One interface language everywhere. Roles differ by **permission**, not
paradigm: the teacher's slash catalog composes (includes the ◆ AI group); the
student's catalog observes (no command produces words the student didn't
write).

## What the reading editor discovered (and what we keep)

The reading-editor work (`src/components/teacher/reading-editor/`) proved out
four elements. All four transfer; each gets a familiar carrier:

| Element | Was (manuscript) | Becomes (familiar idiom) |
|---|---|---|
| The surface | Floating parchment sheet, epigraph | Plain white page: breadcrumbs, big sans title, hover `+ ⋮⋮` handles |
| The spine | Bespoke margin rail | Sidebar **outline** (where Notion puts nav) + **census card** below it |
| Slash catalog | Already Notion-like | Unchanged mechanics; catalog contents become the permission surface |
| ◆ provenance | Olive rule + italic in-flow | Teacher: olive **callout blocks** with provenance meta-line. Student: olive **margin comments** |

Styling: neutral field (white page, `#F7F6F3` sidebar, warm-black text,
hairline borders, system sans). **Olive is the only hue on the page** — if it
has color, the system said it; if it's ink, a human wrote it. This makes
provenance more legible than the parchment version, where warmth was ambient
and olive had to fight for contrast.

## Prototype A — teacher: the lesson is one page

Plan view, per-block editors, and the reading editor merge into a single
document at `/teacher/lessons/[lesson_id]`. The teacher writes the lesson top
to bottom in the order the student will live it.

- **Sidebar outline** replaces the plan-view block list. Derived state only:
  one row per block, provenance glyph (¶ prose, § source, ◆ AI, ✓ check,
  ✦ prompt), word weight. Drag to reorder; click to jump.
- **Census card** (generalizes the composition ledger): teacher words /
  sources / AI-generated as a three-segment bar. Voice drift is visible before
  the lesson ships.
- **Sources are quote blocks** with structural citations (citation is data,
  not text) so the student side can link them and the substrate can cite them.
- **All non-prose blocks are callouts** — one visual system, differentiated by
  icon and tint: ◆ AI segments (olive, provenance meta-line always visible),
  ✓ checks (amber, auto-marked), ✦ central prompt (bordered). The separate
  quiz editor folds in.
- **AI generation keeps the existing contract** (`/api/teacher/generate-segment`):
  brief in via the transient aiPrompt widget, server-stamped segment out.
  Teacher cannot forge a generation stamp. Catalog can grow by kind
  (e.g. AI chronology) without changing the grammar.

## Prototype B — student: the response is the student's page; the AI is a commenter

Same editor at the session route, inverted voice. The student's writing is the
only content in the flow.

- **Sidebar outline maps reasoning moves, not blocks**: the student's
  paragraphs tagged with the substrate's locked role axis (claim / support /
  challenge / inquiry). The doc map and the argument map become one object.
- **Census card = shape of the argument**: counts, not scores. "Claims
  without support: 1" is the gap-surface call made ambient — visible, quiet,
  never blocking.
- **AI observations are margin comments** — the pattern every student knows
  from Docs, and exactly the architecture rule ("AI beside the writing, never
  inside it") expressed as convention. Anchored via olive underline in the
  text; `Dismiss` / `Mark addressed`; dashed pending state. Nothing modal;
  nothing ever rewrites.
- **Student slash catalog** (all inserts, none generate):
  - `Text` — plain paragraph
  - `Quote from materials` — cited excerpt, from this lesson's sources only
  - `Mark this paragraph as claim/support/challenge/inquiry` — metadata only
  - `◆ Ask what the AI notices here` — summons a *comment into the margin*,
    never text into the draft (status: open question 3)

## Prototype C — the menu is the permissions page

Identical menu chrome, keys, grouping for both roles. Catalog contents differ:
teacher gains the ◆ compose group; the student's menu deliberately lacks
AI paragraph / continue / polish / suggest evidence / summarize — absence is
load-bearing. A future TA role slots between without new surfaces.

## Invariants

1. **Owner owns the center.** The page-owner's writing is always the largest,
   brightest element; system and navigation live in sidebar/margins.
2. **Insert, never rewrite.** Every slash command adds a block; no command on
   any surface edits existing prose. This is what makes one grammar safe to
   share across roles.
3. **Olive is the only colored voice.** Callouts, comments, census bars.
4. **Outline is derived, census is honest.** The sidebar projects the doc
   (teacher) or the substrate (student); it never holds independent state.
5. **Permission lives in the catalog**, not in separate apps.

## Architectural notes

- Existing components are the seed, not a rewrite: `extensions.ts` (TipTap
  nodes), `SlashMenu`, `BlockHandle`, `AIPromptWidget`, serializer, and the
  generate-segment route all carry over. `SegmentSpine` restyles into the
  sidebar outline. The manuscript chrome (sheet/epigraph styling) is replaced.
- Student-side move-tagging must round-trip through the substrate
  (`nodes.role` is the locked axis); the outline reads from it, per invariant 4.
- "Ask what the AI notices" would be a new bounded LLM call or a variant of
  the existing turn call — **adding a pipeline call is an architecture
  decision** (prompt rule 2) and is gated on open question 3.
- Run `/paideia-fidelity-check` before implementing Prototype B (student-facing
  loop changes: move-marking, summoned comments).

## Open questions — unresolved, decisions pending

1. **Lesson as one doc.** Merge plan view + block editors + reading editor
   into one page (as drawn), or keep block cards standardized on this editor?
   Where do per-block private teacher notes live (proposal: teacher margin
   comments, symmetric with the student rail)?
2. **Who names the moves.** Student-only, ingest-only, or hybrid (drawn:
   ingest proposes as dashed chip, student confirms/re-marks)?
3. **Summoned comments.** Keep `◆ Ask what the AI notices` as-is, rate-limit
   it / fold it into Save & reflect, or cut it (comments purely turn-driven)?
   Closest-to-the-line element in the design.
4. **Identity.** Fully neutral everywhere (as drawn), or serif/parchment
   retained where students *read* (rendered readings, artifacts) with neutral
   reserved for *working* surfaces?
