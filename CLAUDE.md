# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — Next.js dev server (App Router; loads `.env` automatically).
- `npm run build` / `npm start` — production build / serve.
- `npm run db:reset` — **destructive.** `tsx --env-file=.env db/bootstrap.ts` runs `db/schema.sql` (which opens with `drop schema if exists public cascade`) and reseeds canonical fixtures (Mr. K, Maya, two lessons, one completed Versailles session graph). Run this after any change to `db/schema.sql`.
- `docker compose up -d` — start Postgres (image `postgres:16-alpine`, container `paideia-db`, exposed on host **port 5433**, user/pass/db all `paideia`).
- No test, lint, or typecheck scripts are defined in `package.json`. `tsc --noEmit` works (config has `"noEmit": true`) but is not wired into a script.

Required env vars (`.env`, see `.env.example`): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `BACKBOARD_API_KEY`.

## Architecture

Three subsystems with strict directional rules. The philosophical commitment ("LLM never performs the student's reasoning") is enforced structurally — by schema shapes, not just prompts. See `philosophy.md` for the long form.

### Postgres is ground truth (`db/schema.sql`)

- The LLM **never writes the substrate directly.** Bounded LLM calls emit Zod-validated proposals; deterministic appliers fold them into `nodes`/`edges`.
- Substrate schema uses the **locked-role + open-kind** pattern: `nodes.role ∈ {assertion, support, challenge, inquiry}` and `edges.relation ∈ {positive, negative, depends}` are closed (graph traversal/queries operate on these); `kind` is a free-form LLM-proposed descriptor (e.g. `"causal claim"`, `"counterexample"`). Apply this pattern to any new schema (also seen on `artifacts.type`).
- `turns.raw_prose` is captured **before** any LLM call so student input is never lost on LLM failure.
- `src/lib/db.ts` holds the single `postgres` template tag, stashed on `globalThis` to survive Next.js dev HMR without leaking pooled connections.

### A2UI is the FFI between LLM and renderer (`src/lib/a2ui/`, `src/components/a2ui/`)

- The composer LLM emits a typed spec; `Renderer.tsx` re-validates with `parseA2UISpec` at the boundary and dispatches by discriminated union. **Validation must be loud, not silently rendered as half-broken UI.**
- The component catalog is **locked at 5 types**: `ComposedNarrative`, `QuestionPrompt`, `ArtifactCard`, `ArtifactGrid`, `SourceReference`. Adding a new component requires a coordinated change to the Zod discriminated union in `spec.ts` *and* the `switch` in `Renderer.tsx` (TS exhaustiveness will catch a missing case).
- `parseA2UISpec` enforces structural invariants beyond Zod: unique component IDs, every `root_id` resolves, every `ArtifactGrid.card_ids` entry points at an `ArtifactCard`.
- `Sentence.cites: string[]` references substrate node IDs. Empty `cites` is allowed only for meta-prose (e.g. headings); the renderer signals uncited prose visually because **uncited content is the drift signal** (the system performed reasoning the substrate doesn't support).

### Backboard is retrieval over composed prose, never source of truth (`src/lib/backboard/`)

- One assistant per scope, named `paideia-{student|lesson|teacher}-{id}`. Resolution order in `scopes.ts`: `backboard_scopes` table → `listAssistants()` name match → `createAssistant()` with the scope-appropriate system prompt; cache row upserted on every successful path.
- **Per-user isolation = per-assistant.** Sharing assistants with `memory="Auto"` leaks data across users.
- **Writes are fire-and-forget** (`writes.ts`): all calls are `void`-callable, errors caught and logged, never thrown. Backboard outage must never block the request loop.
- **Reads are one-shot `Readonly` threads** (`retrieval.ts`) that return `""` on any failure — callers proceed without the extra context.
- `client.ts` uses `X-API-Key` (not Bearer). `addMessage` uses form-data, not JSON. Memory writes are async: poll `getMemoryOperationStatus` (returns `IN_PROGRESS|PROCESSING|COMPLETED|FAILED`) only when read-after-write ordering matters; use `waitForMemory` from `poll.ts`.
- Document indexing uses lowercase status (`pending|processing|indexed|error`); memory ops use uppercase. Don't conflate.
- **If Backboard contradicts Postgres, Postgres wins.** Never store Backboard memory IDs as Postgres foreign keys (memories are immutable; update = delete + add, ID changes).

### Boundary discipline

- LLM I/O is **always** Zod-validated. Schemas should be shaped to make conclusion-supply structurally impossible (no free-form "summary" or "answer" fields).
- Pipeline, not agent. Bounded steps with typed inputs and outputs; substrate is the system of record between steps, not LLM conversation history.
- AI-emitted UI is the A2UI catalog; student-authoring UI is hand-built React. Don't mix.

## Conventions

- TS path alias: `@/*` → `src/*`.
- App Router under `src/app/`. Demo route exercising the renderer: `/a2ui-demo` (see `src/lib/a2ui/example-specs.ts` for canonical spec shapes).
- Stack pinned versions matter: **Next.js 16.2** (see AGENTS.md — APIs differ from training data; consult `node_modules/next/dist/docs/`), React 19.2, **Zod v4** (not v3), `postgres` 3.4 template-literal driver (not Drizzle, despite earlier design notes).

## Paideia rules

This product encodes a specific philosophical commitment (`philosophy.md`): the activity of reasoning is what learning consists of, and tools that perform reasoning *for* the student prevent the capacity from forming. Three layers, in order of bindingness: **capacity-formation → architecture → surface**. The diagnostic for any decision is **"which layer is this violating?"**

The non-negotiables below are always loaded. Procedural depth lives in skills:
- `/paideia-prompt` — writing or editing any LLM prompt.
- `/paideia-component` — designing or editing any UI component or microcopy.
- `/paideia-fidelity-check` — auditing a candidate change against the four fidelity tests.

### Prompt rules

1. **The LLM never writes the substrate directly.** Bounded calls emit Zod-validated proposals; deterministic appliers fold them into nodes/edges. *(architecture)*
2. **Pipeline, not agent.** A fixed registry of bounded calls, one module each under `src/lib/llm/` — student path: turn call, reading composer, progression composer, artifact composer; teacher path: lesson-content composer, class-summary composer, teacher lesson chat. Adding a call is an architecture decision, not a prompt edit; the student-path calls carry the full weight of rules 3–5. *(architecture)*
3. **No free-form completion fields in any LLM output schema.** No `summary`, `answer`, `recommendation`, `reasoning`, or open-ended `notes`. If the LLM could fill it with a conclusion, the schema is wrong. *(architecture, enforces capacity-formation)*
4. **Every composed sentence cites substrate node IDs.** Empty `cites` is allowed only for meta-prose (headings) and is visually flagged. Uncited prose is the drift signal. *(architecture)*
5. **Voice is observational and structural, never declarative or evaluative.** "There is a tension between n3 and n5" — yes. "n5 is correct," "the answer is," "you should conclude" — never. *(surface, enforced in prompts)*
6. **Memory informs which question to ask next, never what to say on the student's behalf.** Backboard recall feeds prompt context; it does not author student-facing prose. *(architecture)*
7. **Postgres is ground truth. Backboard is retrieval over composed prose.** If they conflict, Postgres wins. Memory writes are fire-and-forget; outage must not block the request loop. *(architecture)*
8. **Conversation history is not source of truth.** Each pipeline call rebuilds context from substrate. *(architecture)*

### Interface rules

1. **Student writing is the foreground.** Largest, brightest, most weighted element on screen. AI surfaces are peripheral, dismissible, never modal. *(surface, enforces architecture)*
2. **No completion affordances on the student surface.** No "help me write this," "suggest evidence," "find counter-arguments," "polish," autocomplete, or chat-paste-back. *(capacity-formation, surfaced visually)*
3. **AI-emitted UI = A2UI catalog. Student-authoring UI = hand-built React.** Don't mix. The catalog is locked at five components. *(architecture)*
4. **Microcopy: second person, open question.** Empty states and unresolved tensions are first-class design elements, not friction to smooth over. *(surface)*
5. **Friction polarity: semantic yes, interactional no.** The AI's question is hard; the typing is fast and the widgets drop in cleanly. *(surface)*
6. **Cohort visibility is structural-only by default.** Students see others' move structures, not their prose. *(surface, enforces capacity-formation)*
7. **Provenance is preserved at the move level.** No AI-generated text is silently incorporated into the student's reasoning artifact. Teacher view can always distinguish what the AI surfaced from what the student wrote. *(architecture)*

### When a rule and a feature request collide

The rule wins. Forty years of failed edtech is forty years of tools that performed the activity of learning for students. The default-pulls of LLM tooling — chat surfaces, agent loops, "let me help you write that" — are exactly the patterns the philosophy is designed against. If a request reads as natural and obvious, run `/paideia-fidelity-check` before implementing.
