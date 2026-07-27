# Paideia

A learning platform built on one commitment: the activity of reasoning is what
learning consists of, and a tool that performs that activity for the student
prevents the capacity from forming. The AI here never writes the student's
reasoning. It reads what the student wrote and answers with structure: an
observation, a question, a tension between two of the student's own claims.
The conclusions stay the student's to reach.

## What it is

Students work through a lesson by writing. Each turn, their prose is captured
first and then parsed into a typed reasoning graph: assertions, support,
challenges, open inquiries, and the relations between them. What the AI sends
back is composed from that graph, and every sentence it composes cites the graph
nodes it read from. A sentence with no citation is flagged in the interface,
because uncited prose is the signal that the system drifted into reasoning the
student did not do.

Teachers author lessons, attach materials, and read the class through the same
graphs: where each student's reasoning went, which moves recur across the
cohort, and where attention is worth spending. Cohort visibility is structural
by default; students see the shape of each other's moves, and the prose stays
private.

## Architecture

Three subsystems, with strict directional rules. The philosophical commitment
is enforced by schema shapes, not by prompt wording.

**Postgres is ground truth.** The substrate (`db/schema.sql`) stores the
reasoning graph. The LLM never writes it directly: bounded calls emit
Zod-validated proposals, and deterministic appliers fold them into nodes and
edges. Node roles and edge relations are closed enums that queries and
traversals operate on; `kind` is left open for the model to describe.

**A2UI is the boundary between LLM and renderer.** The composer emits a typed
spec (`src/lib/a2ui/`), which is re-validated at the render boundary and
dispatched from a component catalog locked at five types. Validation failures
are loud. Adding a component is a coordinated schema-and-renderer change, and
deliberately so.

**Backboard is retrieval, and Postgres wins.** Memory informs which question to
ask next. Writes are fire-and-forget, reads return empty on failure, and an
outage never blocks the request loop. When memory and substrate disagree, the
substrate is right.

The pipeline is a fixed set of bounded calls with typed inputs and typed
outputs, rebuilt from the substrate each turn rather than from conversation
history. No output schema on the student path has a free-form completion field:
no `answer`, no `summary`, no `recommendation`. If the model could fill a field
with a conclusion, the schema is wrong.

## Running it

```bash
docker compose up -d   # Postgres 16, exposed on port 5433
cp .env.example .env   # DATABASE_URL, ANTHROPIC_API_KEY, BACKBOARD_API_KEY
npm run db:reset       # destructive: rebuilds the schema and reseeds fixtures
npm run dev
```

Next.js 16.2 with the App Router, React 19.2, Zod 4, and the `postgres`
template-literal driver. `/a2ui-demo` exercises the renderer against canonical
specs.

## Where to read

| File | What it is |
|---|---|
| [`philosophy.md`](philosophy.md) | The long form: the lineage from Aristotle to Vallor, the empirical evidence, and the fidelity tests every feature must pass |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for development in this repo, including the prompt rules and interface rules |
| [`db/schema.sql`](db/schema.sql) | The substrate |
| `docs/` | Dated design specs and field research |
