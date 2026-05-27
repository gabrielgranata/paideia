---
name: paideia-fidelity-check
description: Use before merging anything that touches the student-facing loop, after a pipeline-prompt edit, when a change touches the locked counts (pipeline calls, A2UI components) or closed enums, or when a design decision feels close to the line.
---

# Fidelity check

Audit a candidate change for paideia-alignment. **The four tests below are necessary, not sufficient.** Pass-pass-pass-pass is not "ship" — it is "no structural reason to block; now check the second-order layer." A skill that bounds inquiry at four checks fails by false-pass.

A failed test is a structural signal — most often that the change has drifted from one layer of theoretical commitment (capacity-formation / architecture / surface) into the next.

## How to run

1. **Locked-invariants pre-check.**
2. **The four tests.** Pass / fail / unclear plus reasoning per test.
3. **Second-order check.**
4. **Rationalization & red-flag review.**
5. Verdict. Don't soften. *Unclear is fail until it isn't.*

## 1. Locked-invariants pre-check

Does the change touch any load-bearing count or closed enum?

- Five pipeline calls (`ingest`, `gap-surface`, `reading composer`, `progression composer`, `artifact composer`)
- Five A2UI components (`ComposedNarrative`, `QuestionPrompt`, `ArtifactCard`, `ArtifactGrid`, `SourceReference`)
- `nodes.role` ∈ {assertion, support, challenge, inquiry}
- `edges.relation` ∈ {positive, negative, depends}
- The gap-surface discriminated union

**If yes:** this is an architecture decision regardless of how the four tests come out. Route to that conversation first. Adding a "new trigger" that runs a "new call site" is adding a sixth pipeline call — even if every schema and component is approved. Behavioral equivalence at the output layer does not preserve invariants at the orchestration layer.

## 2. The four tests

### Next-move test

> After this interaction, who made the next inferential move — the student or the system?

**Pass:** the system surfaced something that *forced* the student to make the next inferential move themselves.

**Fail:** the system made the move — composed an argument, supplied an answer, smoothed a tension, recommended a conclusion.

**Mandatory sub-question:** *What shaped which thing got surfaced — the substrate's actual shape, or a model of the student?* If the surfacing tracks a learner-model (perceived deficits, weak moves, prior errors), the rule "memory informs which question, never what to say" is satisfied literally and violated structurally. The student still wrote the next move, but the system shifted from *responsive to substrate* to *remedial against student-model* — diagnostic-becomes-treatment drift. **Layer when fail:** capacity-formation.

**Failure modes:** "summarize for the student," "suggest a thesis," "polish this paragraph," autocomplete inside student input, a `recommendation` / `reasoning` / `notes` field in an LLM output schema, *memory or prior-history that biases what the system surfaces toward what the student "needs to practice."*

### Trace test

> Does the interaction leave a typed, queryable trace in the substrate that a teacher could later drill into?

**Pass:** the move appended typed events / nodes / edges with AI provenance distinct from student writing. Inputs that *shape* what got surfaced (memory recall, prior-history bias, structural triggers) are anchored in Postgres, not transient in prompt context.

**Fail:** ephemeral chat, unrecorded LLM call, prose folded into the student's document with no provenance, *or* a load-bearing input to the surfacing decision living only in transient retrieval / prompt context.

**Layer when fail:** architecture.

### Recede test

> During use, does the AI surface remain peripheral, or does the student have to leave the work to interact with the AI?

**Pass:** AI surface is peripheral, dismissible, ready-to-hand. Student writing is foreground at all times.

**Fail:** AI surface is foregrounded, modal, or requires a context switch (open chat, copy-paste, switch tab).

**Layer when fail:** surface — but persistent failures here usually indicate architecture has admitted a chat-shaped interaction where it should have a substrate-shaped one.

**Failure modes:** chat panel as primary AI surface; AI responses long enough to read as content rather than as a structural prompt; loading states that mimic composed prose; latency >1s for peripheral prompts.

### Off-platform test

> If a student worked in this way for a semester and then sat down without the platform, would they reason better, the same, or worse than a peer who didn't use Paideia?

**Pass:** the activity habituated transfers — formulating a claim, defending it, integrating a counterexample, naming a tension.

**Fail:** the activity habituated is asking the AI, accepting its synthesis, lightly editing.

**Layer when fail:** capacity-formation. The hardest test to game; a change can pass the other three in the demo room and still fail off-platform if the dominant *activity it habituates* is delegation.

## 3. Second-order check (run after the four tests)

After all four pass, ask explicitly:

- **What concerns does this raise that the four tests don't name?** Vocabulary leakage to student-visible surfaces (e.g. node IDs in teacher prose). Concurrency hazards (memory-state-dependent behavior under async writes). Cohort-visibility implications. Provenance ambiguity at storage boundaries (scaffold-plus-prose blobs).
- **What is the likely next PR after this one?** "Read aloud" → "summarize aloud." "Move-list scaffold" → "suggested feedback phrases." `reasoning: string` for debug → `alternatives_considered: string` next sprint. If the natural extension fails, draw the line **structurally** (in code or schema), not in a comment or reviewer memory.
- **Are you about to ship-conditional with two or more guardrails?** That's a signal you may be papering over an architecture decision with reviewer discipline. Promote to architecture conversation.

## 4. Rationalizations to watch for

| Excuse | Reality |
|---|---|
| "Same outputs, same schemas — just a refactor." | Schemas bound what *a single call emits*; they don't bound *which calls run when*. Equivalence at output ≠ equivalence at orchestration. |
| "It's just a [trigger / hint / debug field / context]." | A trigger / hint / debug *of what?* The harm in a `reasoning: string` field is at generation time, not emission time — stripping it before render doesn't undo the conditioning effect on the rest of the structured output. |
| "Memory informs which question, not the answer." | Permitted when memory's input is the substrate's shape. Violated when memory inputs a learner-model. Distinguish substrate-tracking from student-tracking. |
| "Existing component, existing schema, locked catalog — no new types." | Doesn't matter if the call site is new. A sixth call that emits an approved schema via an approved component is still a sixth call. |
| "Beta users / PM asked for it." | The default-pull. Closure-delivery, summary, completion — these are exactly the requests Paideia is built to resist. User demand on these is the signal the system is working as designed, not failing. |
| "It's teacher-side only / debug-only / internal-only." | Verify the boundary is structurally enforceable, not a runtime claim or a comment. Check storage boundary and rendering boundary separately. |
| "All four tests passed." | Tests are necessary, not sufficient. Re-run the second-order check. |

## 5. Red flags — slow down before verdict

- All four tests passed in under a minute and the verdict came easily.
- Proposal frames itself as "refactor," "accommodation," "debug," "internal," or "same outputs."
- You're about to ship-conditional with two or more guardrails.
- Proposal cites a paideia rule and claims literal compliance — verify *spirit*, not just letter.
- Change is "small" but touches a load-bearing count or closed enum.
- Proposal solves a metric (bounce rate, time-on-task, completion) by reducing the activity the metric was supposed to indicate.

When you see these, return to the locked-invariants pre-check and the second-order section before verdicting.

## Interpreting failures

- **Pre-check fail:** stop the audit. Architecture decision; route to that conversation.
- **Next-move fail:** restructure the output schema or the affordance. If the sub-question fail (learner-model, not substrate), the surfacing logic itself needs rebuilding around substrate.
- **Trace fail:** move the interaction onto the substrate. Anchor any AI output *and any decision-shaping input* (memory recall, bias, trigger evaluation) as typed events with node IDs.
- **Recede fail:** rebuild surface as peripheral, dismissible, non-modal. If the interaction needs more space, ask whether it should be a teacher surface, not a student one.
- **Off-platform fail:** tutor-aligned in its core activity, regardless of in-session feel. Usually a redesign, not a tweak.

## When all four pass and second-order is clean

Ship. Note the audit pass briefly in the change description so the next reviewer can see the discipline was applied.

## When you can't tell

If a verdict is genuinely unclear — usually because the change is novel and doesn't map cleanly to past patterns — instrument it: ship behind a flag, watch the trace, ask whether the substrate got richer or thinner under the change. **Do not declare unclear → pass.** The bias of the training data and the bias of the demo room both push toward unclear → pass; resist both.
