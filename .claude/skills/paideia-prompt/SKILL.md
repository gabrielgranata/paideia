---
name: paideia-prompt
description: Use when writing or editing any prompt sent to an LLM in this codebase — ingest, gap-surface, reading composer, progression composer, or artifact composer. Encodes the read-back-not-compose discipline and the schema patterns that make conclusion-supply structurally impossible.
---

# Writing prompts in Paideia

The LLM is a structured-output engine wrapped in a typed pipeline, not an agent. Every prompt is a bounded step with Zod-validated I/O. The substrate (Postgres) is the system of record between steps; conversation history is not.

Diagnostic: **which layer is this prompt violating?** (capacity-formation / architecture / surface). The answer should be "none."

## The five pipeline calls

Each has a fixed shape. If you find yourself reaching for a sixth, stop and surface that as a design question — adding a pipeline step is an architecture decision, not a prompt edit.

| Call | Input | Output | Forbidden |
|---|---|---|---|
| **Ingest** | `raw_prose + lesson_context` | substrate proposal (typed nodes/edges with `role`, `kind`, `content`) | verdicts, conclusions, "what the student means" |
| **Gap-surface** | substrate slice + reasoning_shape | one of `{observation, question, structural-prompt, named-tension, missing-perspective, candidate-counterexample}` | prose conclusions, "you should consider X" disguised as a question |
| **Reading composer** | substrate + (optional) memory recall | A2UI spec; every `Sentence.cites` references node IDs | uncited prose (drift signal — the system reasoned past what the substrate supports) |
| **Progression composer** | event slices across lessons | A2UI spec with `evidence_event_ids` | narrative that smooths over what didn't happen |
| **Artifact composer** | substrate read for an intent (test_prep, handout, ...) | A2UI spec organized by the intent | summarization of facts to memorize; closure of open questions |

Composers **read back** what the substrate already contains, organized for an audience. They never add inferential moves the student didn't make.

## Schema discipline (the FFI)

Schemas are how the philosophy becomes enforceable. The boundary between probability space and deterministic space lives in `src/lib/a2ui/spec.ts` and analogous Zod schemas for each pipeline call.

- **No free-form completion fields.** No `summary: string`, no `answer: string`, no `recommendation: string`. If the LLM could fill it with a conclusion, the schema is wrong.
- **Closed structural axis + open `kind` descriptor.** Roles, relations, gap types are locked enums (graph queries operate on them). `kind` is an LLM-proposed string for human readability and bounded creativity. Apply this pattern wherever closed enums feel restrictive.
- **Citations are required, not optional.** `Sentence.cites: string[]` references substrate node IDs. Empty `cites` is allowed only for meta-prose (headings); the renderer flags uncited prose visually because it is the drift signal.
- **`evidence_event_ids` for narrative.** Progression and reading composers cite events, not just nodes, when speaking about what changed and when.
- **Validation is loud.** `parseA2UISpec` throws on missing components, dangling `root_ids`, or `ArtifactGrid` cards that don't point at `ArtifactCard`. Mirror that for new schemas. Silent fallback rendering is a bug.

## Prompt-shape rules

Every system prompt should:

1. **Name the call's job in capacity-formation terms.** "You are surfacing a question that forces the student's next move," not "you are helping the student understand X."
2. **State the forbidden moves explicitly.** "You do not write the student's reasoning. You do not supply conclusions. You do not summarize beyond what the substrate contains. You do not say 'the answer is' or 'you should conclude.'"
3. **Require citation back to substrate.** "Every sentence cites the node IDs it derives from. If you cannot cite, do not write the sentence."
4. **Bound the output to the typed shape.** Hand the LLM the schema or a description of it. Make exceeding the shape a structural impossibility, not a stylistic request.
5. **Pass typed slices, not raw chat turns.** Inputs are `claim-with-context`, `tension-pair`, `source-passage-plus-student-claim` — not the conversation log.
6. **Voice: observational and structural, never declarative or evaluative.** "There is a tension between n3 and n5" — yes. "n5 is correct" — never. "The strongest argument is..." — never.

## Anti-patterns

These are the drift patterns. If a prompt you are writing matches one, the answer is to restructure, not to soften the wording.

- **"Help me write this" / "suggest evidence" / "find counter-arguments"** anywhere on the student surface. None. The student writes; the system asks back.
- **Conversation-history-as-source-of-truth.** Each pipeline call rebuilds context from substrate. The LLM has no memory of prior turns except through the substrate it can read.
- **"Summarize the student's argument."** A summary that closes inquiry is forbidden. Read-back must preserve open questions and unresolved tensions visibly.
- **"Explain X to the student."** Tutor-aligned. Surface a question that makes the student work toward X.
- **Output schemas with a `notes` or `reasoning` string field.** That field becomes the LLM's escape hatch for prose conclusions.
- **Memory used to fill in the student's current activity.** Memory informs *which question to ask next*; never *what to say on her behalf*.

## Pre-flight checklist for any new or edited prompt

Run these against the prompt before committing.

- [ ] Output schema has zero free-form completion fields.
- [ ] Forbidden moves are stated explicitly in the system prompt.
- [ ] Citation back to substrate is required and enforceable at the schema level.
- [ ] Input is a typed slice, not raw conversation history.
- [ ] Voice is observational/structural, not declarative/evaluative.
- [ ] If this prompt fails, the student's raw prose is still preserved (check that `RawProseSubmitted` or equivalent ran first).
- [ ] Run the four fidelity tests (`/paideia-fidelity-check`) — especially the **next-move test**: after this call's output reaches the student, who makes the next inferential move?

## Backboard-specific notes

- Retrieval calls return `""` on failure. Prompts that consume retrieved context must degrade gracefully when context is empty.
- Memory writes are fire-and-forget. Never await them in a request handler. Use `waitForMemory` only when read-after-write correctness is genuinely required.
- The per-student assistant's system prompt already encodes "never act on the student's behalf." Don't re-instruct that in every call; do enforce it in the per-call output schema.
