---
name: paideia-component
description: Use when designing or editing any user-facing component, page, or microcopy in this codebase — student session UI, teacher view, artifact pages, A2UI components. Encodes the ready-to-hand interface discipline and the foreground/background hierarchy that keeps the student's writing primary.
---

# Designing interface in Paideia

The activity of reasoning is the foreground. The tooling is equipment in Heidegger's sense — ready-to-hand and recessive. When the AI surface becomes more salient than the student's argument, the design has failed.

Diagnostic: **which layer is this violating?** (capacity-formation / architecture / surface).

## Surface taxonomy

Two kinds of UI, with non-overlapping rules.

- **Student-authoring UI = hand-built React.** Inputs, navigation, the document the student writes into. The system does not generate this surface.
- **AI-emitted UI = A2UI catalog** (`src/components/a2ui/`). Composed views, artifact bodies, question prompts. The renderer renders what the substrate already contains. It never generates.

Don't mix. A "smart input" that the LLM modifies in place is a category error — that's the LLM authoring on the student's surface.

## Visual hierarchy

The student's writing must be the largest, brightest, most weighted element on screen.

- **Foreground:** the document, the substrate, the student's prose.
- **Peripheral:** AI surfacings (questions, structural prompts, observations). Smaller, dismissible, never modal, never demanding the student leave the work.
- **Background:** the system itself. Chrome, navigation, status. Recedes during use.

If a candidate change makes any AI surface bigger or more central than the student's writing, the change fails the **recede test** before any other check.

## Microcopy rules

The AI's voice in the UI is observational and structural, never declarative or evaluative.

- **Second person, open question.** "What would convince you that n3 is wrong?" Not: "n3 is wrong because..."
- **Name structure, not verdicts.** "There is an unresolved tension between n3 and n5." Not: "n5 is the better claim."
- **Surface, never close.** Empty states, blank fields, and unresolved tensions are first-class design elements. Do not paper them over with helpful defaults that pre-supply a direction.
- **No "the answer is."** No "you should conclude." No "the strongest argument is." If a copy line evaluates the student's reasoning, rewrite it as a question.

## Affordance rules (student surface)

If any of these affordances appears anywhere a student touches, it is tutor-aligned and must be removed or restructured.

- "Help me write this"
- "Suggest evidence"
- "Find counter-arguments"
- "Auto-complete this paragraph"
- "Polish my writing"
- A chat box that returns prose the student can paste

Permitted affordances:

- A peripheral question prompt the student must answer in their own writing.
- A structural noticing ("you have an assertion at n5 with no support edge") that points at substrate but supplies no content.
- A material reference ("source passage 3 is relevant here") that points at the source, not at a conclusion drawn from it.
- A dismiss control on every AI surfacing.

## Friction discipline

Two kinds of friction. Get the polarity right.

- **Semantic friction: yes.** The AI's question is hard. The substrate makes inconsistency unavoidable. Empty states force a first move. Productive resistance (Dewey's felt difficulty) is preserved.
- **Interactional friction: no.** Typing is fast. Widgets drop in cleanly. The AI responds in 200ms with a peripheral prompt, not 4 seconds with a polished paragraph. Latency budgets prefer ready-to-hand quietness over impressive verbosity.

The friction that forms hexis lives in the thinking, not in tool-management.

## A2UI catalog discipline

The catalog is locked at five components. Adding a new one is an architecture decision, not a UI decision.

- `ComposedNarrative` — sentences with explicit citations to substrate nodes; the only legitimate way to render LLM-composed prose. Uncited sentences are visually flagged.
- `QuestionPrompt` — the load-bearing AI contribution. Carries `target_node_ids` and `gap_type` so the prompt is anchored to substrate, not free-floating.
- `ArtifactCard`, `ArtifactGrid` — render artifacts the student or teacher has created. Generative-feeling but never generative; cards link to artifact pages.
- `SourceReference` — points at sources, never substitutes for them.

Renderer re-validates the spec at the boundary. Invalid specs throw — do not render half-broken UI silently.

## Cohort and teacher surfaces

- **Cohort visibility is structural-only by default.** Students can see how others' move structures look (which roles, which kinds, which connections), not their prose. The structural-only constraint is what makes legitimate peripheral participation safe.
- **Teacher view is reflection-on-action** (Schön). Pattern queries across documents and across students. Drill-down from prompt → student → substrate node. Not a per-document reading session.
- **Teacher annotations propagate as memory writes** to the appropriate scope (`paideia-teacher-{id}` or as a cohort pattern on `paideia-lesson-{id}`).

## Pre-flight checklist for any new or edited component

- [ ] Student writing is visually weightier than any AI surface on the same screen.
- [ ] No completion affordance on the student-facing path.
- [ ] All AI-rendered prose cites substrate node IDs (or is meta-prose, visibly marked).
- [ ] All copy is in second person and frames open questions, not declarations.
- [ ] AI surfaces are dismissible and never modal.
- [ ] If this is an AI-emitted surface, it lives in the A2UI catalog and the spec validates.
- [ ] Run `/paideia-fidelity-check` — especially the **recede test** and the **next-move test**.

## Anti-patterns

- A chat panel on the student's document. The chat surface foregrounds the tool (Heidegger fail) and hides the substrate (trace-test fail).
- A "polish" or "improve" button. Tutor-aligned. The improvement is what the student is supposed to be doing.
- A loading skeleton that mimics composed prose before the response arrives. Trains the student to expect AI prose where their own prose belongs.
- A confidence score on an AI surfacing ("88% sure this is a missing warrant"). Theatrical certainty is evaluative voice. Either the question is worth surfacing or it isn't.
- Inline AI suggestions inside the student's text input. Substitutes the AI's authoring for the student's. Always wrong on the student surface.
