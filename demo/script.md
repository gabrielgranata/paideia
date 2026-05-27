# Paideia demo — walkthrough + copy-paste companion

Two parts. **Part 1 — Walkthrough** sequences UI actions in demo order: sign in, create course, build Lesson 3 (Plan View · sortable blocks · Reading Doc Editor · Generate Panel · ChatPanel · Preview Mode), student logs in and writes across three modes (Notes · Draft · Reflection), teacher reads the composed reading and annotates. **Part 2 — Reference appendix** holds the copy-paste payloads as Beats 1–20. The walkthrough references beats by number. Roadmap items (widgets, engage/dismiss, /progression, etc.) live in `demo/build-prompts.md` as F1–F15.

**Pre-demo state.** `npm run db:reset` → 1 teacher (Mr. Okafor), 1 student (Maya Chen), 2 user accounts. Nothing else. The demo *builds* the course, the lesson, the materials, and the substrate live.

If you reach a beat that isn't here, ask in chat — I'll generate the next piece in the same voice.

---

# Part 1 — Walkthrough

## Phase 0 — Pre-demo setup

| Step | Action |
|---|---|
| 0.1 | `docker compose up -d` (postgres on :5433) |
| 0.2 | `npm run db:reset` — confirm output: `teachers: 1, students: 1, users: 2`, everything else 0 |
| 0.3 | `npm run dev` (Next on :3000) |
| 0.4 | Two browser windows ready, or be ready to swap profiles via `/login` |
| 0.5 | (Optional) one or two stub student signups via `/signup` so the class view isn't empty when you open it |

---

## Phase 1 — Mr. Okafor signs in and creates the course

**Feature: login picker, course creation form.**

### 1.1 Sign in
- Open `http://localhost:3000/`
- Lands on `/login` picker
- Click **Mr. Okafor** card → redirect to `/teacher`

### 1.2 Empty dashboard
- The class view loads with `0 students · 0 flagged`
- The hardcoded class-summary copy is fine; ignore it or note it as v0
- **Say:** "This is what every teacher starts the year with. No students yet, no lessons yet, just the arc he wants to teach."

### 1.3 Create the course
- Click **+ New course** (or navigate to `/teacher/courses/new`)
- Fill the form with **Beat 1**: title, subject, term, year group, arc seed text
- Submit → lands on `/teacher/courses/<id>`

### 1.4 Inspect the course view
- Empty lesson list, course metadata up top
- **Say:** "The arc is now in the system. Every AI surface in this course gets seeded with that arc — students never see it directly, but it's the long-form intent."

---

## Phase 2 — Mr. Okafor builds Lesson 3

**Features: Plan View ↔ Preview Mode toggle, sortable block list, basic block authoring, Reading Doc Editor (TipTap) with Generate Panel (paragraph / chart / diagram), teacher ChatPanel with suggested-action apply, teacher_notes (private rubric).**

### 2.1 Create the lesson skeleton
- From the course view, click **+ New lesson** (or `/teacher/lessons/new`)
- Title + prompt + initial context from **Beat 2**
- Save → lands on `/teacher/lessons/<lesson_id>/edit` (Plan View)

### 2.2 Plan View — the lesson editor
- Default skeleton: Context · Prompt · Response blocks (created by `addLesson`)
- Sortable block list on the left (drag to reorder via `reorderBlock`); block cards in the middle with private-note slots (`TeacherNoteSlot`); **ChatPanel** on the right (`teacher_chats` persisted thread)
- Edit Context and Prompt blocks if they're not already filled
- **Say:** "This is Plan View. Mr. Okafor authors the lesson here. Every block carries a private teacher note. The chat on the right is where he talks with the AI as he builds."

### 2.3 Add the three reading blocks
- Use the add-block affordance three times to create reading blocks
- For each, click into the block to open it and paste body + source from **Beat 3**
- On save, the lesson-scope Backboard assistant indexes each as a document (fire-and-forget per `saveBlockContent` in `actions/teacher.ts`)
- **Say:** "Each reading is uploaded as a document on the lesson's AI scope so retrieval can hit it later. The substrate is Postgres; Backboard is retrieval over composed prose."

### 2.4 Open the Reading Doc Editor
- Click into one of the reading blocks → opens `/teacher/lessons/<lesson_id>/reading/<block_id>`
- TipTap rich-text surface with embedded AI segments (paragraph / chart / diagram)
- **Say:** "Some readings are plain text. Others — like this one — get AI-augmented with paragraphs, charts, diagrams. The teacher composes the document; the AI helps."

### 2.5 Generate Panel — AI paragraph
- In the Reading Doc Editor, click **Generate**
- Sub-kind: **paragraph**. Brief: a prompt from **Beat 18** (paragraph row)
- AI emits a paragraph segment with a non-dismissible provenance footer; drop it at the cursor
- **Say:** "Provenance footer is always visible. The teacher always knows whether the AI extracted this from the materials or proposed it from the topic."

### 2.6 Generate Panel — chart (the headline data-chart feature)
- Click **Generate** again; sub-kind: **chart**
- Brief: chart prompt from **Beat 18** (chart row, e.g. Manchester population growth)
- Optional: paste teacher-supplied data → marks `data_source.kind = "teacher_supplied"`
- AI emits a Vega-Lite chart, rendered live via react-vega; provenance footer visible; "Show data" disclosure works
- **Say:** "This is the data-chart feature. Live Vega-Lite, derived from the materials. The footer tells you who supplied the data; the disclosure lets you audit it."

### 2.7 Generate Panel — diagram
- Click **Generate**; sub-kind: **diagram**
- Brief: diagram prompt from **Beat 18** (diagram row)
- AI emits a diagram segment, dropped at the cursor

### 2.8 ChatPanel — talk with the AI while authoring
- Back in Plan View, the ChatPanel sits on the right
- Type an opener from **Beat 20** (e.g., "I'm building a lesson on whether the working class made itself or got made — what am I missing?")
- AI replies (`sendChatMessage` → `teacher-lesson-chat.ts`); response renders in the thread
- If the reply carries a **suggested_action** (e.g., `create_block` for a chronology), click **Apply** → `applyChatSuggestedAction` runs; the block appears in the Plan View
- **Say:** "The teacher stays the author. AI proposes; teacher applies. No silent edits."

### 2.9 Add the private rubric
- On the Response block's `TeacherNoteSlot`, paste Expected Dimensions from **Beat 5**
- **Say:** "Private to the teacher. Students never see it. The reading composer reads it when composing what Mr. Okafor sees about each student."

### 2.10 Toggle Preview Mode
- Click **Preview** at the top of the editor (or `?mode=preview`)
- Middle column renders the student-facing lesson as `/lesson/<session_id>` would
- Right column shows the teacher's private notes per block, labeled "not visible to student"
- **Say:** "This is what the student sees. Mr. Okafor can toggle into the student view at any time; the private notes stay over here."

### 2.11 (Optional) Reorder or delete
- Drag blocks in the sortable list to reorder (`reorderBlock`)
- Delete a block via its affordance (`deleteBlock`); or the **Delete lesson** button at the bottom (`deleteLesson`)

---

## Phase 3 — Maya signs in and enters the lesson

**Feature: login picker for student, student dashboard, course enrollment, lesson entry.**

### 3.1 Sign out as Mr. Okafor → sign in as Maya
- Top-right **Sign out** on the teacher dashboard
- `/login` → click **Maya Chen** card
- Lands on `/artifacts` (Maya's home)

### 3.2 Maya enrolls in the course
- Navigate to `/courses`
- Click **Enroll** on *Industrial Revolution & Modernity* (calls `enrollInCourse`)

### 3.3 Open Lesson 3
- Click the lesson from the course view, or navigate to `/lesson/start/<lesson_id>`
- A new `session` row gets created with `working_text = {}`
- Lands on `/lesson/<session_id>` — three columns:
  - **Left:** `MaterialsRail` with three readings + chronology
  - **Middle:** `QuestionPrompt` + the writing surface (three modes — Notes / Draft / Reflection)
  - **Right:** `AnnotationsRail` (empty for a new session; observations accumulate as Maya submits turns)

---

## Phase 4 — Maya writes (Notes / Draft / Reflection — four sessions)

**Features: three-mode writing surface (`sessions.working_text = { notes, draft, reflection }`), auto-saved via `saveWorkingText`, `submitTurn` for LLM ingestion, `AnnotationsRail` chronological observations from past `turn-call`s, teacher-side `submitAnnotation`.**

This phase produces the substrate Mr. Okafor reads in Phase 5. Run quickly — most of it is "pre-demo state." Slow down only on Session 4.

The writing surface has three modes the student toggles between:
- **Notes** — private workspace, raw register, think-out-loud
- **Draft** — the essay register, polished prose
- **Reflection** — post-hoc processing ("what changed? what's still open?")

Each mode persists its own text in `sessions.working_text`. **submitTurn** sends the working text through the `turn-call` pipeline, which emits a `next_gap` observation that lands in the AnnotationsRail.

### 4.1 Session 1 — read Hebergam, write the naïve draft
- Open Material 1 in the left rail
- Switch to **Notes** mode → paste pre-edit Note 1 from **Beat 6**
- Switch to **Draft** mode → paste the "victims of the factory" first draft from **Beat 6**
- Click **Submit** (calls `submitTurn`) → AnnotationsRail surfaces Observation 1 (**Beat 14, row 1**)
- Switch back to **Notes** mode → replace with the rewritten Note 1 from **Beat 6** (auto-saves via `saveWorkingText`)

### 4.2 Session 2 — read Thompson, expand the draft
- Open Material 2; read in the left rail
- **Notes:** append Note 2 (**Beat 6**)
- **Draft:** replace the victims paragraph with Para 1 final; append Paras 2, 3, 4 from **Beat 7**
- Click **Submit** → AnnotationsRail surfaces Observation 2 (**Beat 14, row 2**)

> ⚠ **Today:** observations land in the rail chronologically; there's no Engage / Dismiss button on the card yet (roadmap F2). If you want to demo Maya rejecting the gender observation, narrate it verbally — the dismissal reason from **Beat 14** is the line.

### 4.3 Overnight — Mr. Okafor reads and annotates
- Sign out as Maya → sign in as Mr. Okafor
- Open `/teacher/student/student_maya`
- The composed reading renders (computed by `composeReading` against the substrate so far)
- In the **Prompt to student** form, paste Annotation 1 from **Beat 8** → **Send** (calls `submitAnnotation`)
- Sign out

### 4.4 Session 3 — read Engels, the consciousness shift
- Sign in as Maya; the new annotation is visible (currently surfaced in `/memory`; the in-lesson surfacing is roadmap F14)
- Open Material 3 (Engels); read
- **Notes:** append Note 3 (**Beat 6**) — first appearance of "class solidarity"
- **Draft:** append Para 5 (**Beat 7**)
- Click **Submit** → AnnotationsRail accumulates
- **Draft:** append Para 6 (closing question)

### 4.5 Today (Session 4) — the live demo lands here
- (Before live demo:) Mr. Okafor signs in, adds Annotation 2 (**Beat 8**), signs out
- (Right before audience:) sign in as Maya
- Switch to **Reflection** mode (or **Notes** if Reflection's affordance isn't yet labeled — F12)
- Type Note 4 from **Beat 6**
- Click **Submit** → AnnotationsRail surfaces fresh observations (use **Beat 14, rows 3 and 4** as the script of what the AI should ideally surface)
- **The live demo continues from here.** Phase 6 is the headline.

---

## Phase 5 — The teacher's class view (live demo opener, 0:00–1:00)

**Feature: class dashboard, stage chips, flagged-warrant signal, class summary, composed teacher's reading, sentence-level provenance.**

### 5.1 Sign in as Mr. Okafor
- `/login` → Mr. Okafor → `/teacher`

### 5.2 Show the class view
- One student (Maya) — flagged, "developing"
- (If you ran stub signups in Phase 0, more students here)
- Class summary at the top (**Beat 11**)
- **Talking point** from Beat 19, 0:00–0:30

> ⚠ **Today:** charts on the *dashboard* aren't built. Charts live in the Reading Doc Editor (Beat 18). The cohort-coverage chart described in **Beat 18, Chart 2** is a roadmap item (depends on F6's class-summary composer wiring). If you want to nod at it, gesture verbally.

### 5.3 Click Maya's card
- `/teacher/student/student_maya`
- Composed reading lands (**Beat 9**) — RESOLVED / IN PROGRESS / UNADDRESSED / RECOMMENDED NEXT
- **Talking point** from Beat 19, 0:30–1:00

### 5.4 Hover a sentence in the reading
- Provenance surfaces — show that the AI's prose anchors back to specific nodes / turns / annotations
- **Say:** "Every sentence is anchored. The teacher's judgment is what makes meaning here, not the system's."

---

## Phase 6 — The live student moment (1:00–2:15)

**Features: three-mode writing surface, AnnotationsRail (chronological observations from past `turn-call`s), Reflection mode as the "respond to this" register.**

### 6.1 Switch to Maya's view
- Sign in as Maya (or use a parallel browser tab)
- Lands on `/lesson/<session_id>` with the Draft visible, materials in the left rail, AnnotationsRail on the right showing the fresh observations

### 6.2 Frame the surface
- **Talking point** from Beat 19, 1:00–1:30: "This is what Maya sees. Her draft, her sources, her notes. The AI is not in the foreground."

### 6.3 Land on Observation 4 (class solidarity)
- The AnnotationsRail shows the cross-document observation as the most recent card
- The prompt itself names both surfaces (notes ↔ draft) — read it in place
- **Talking point** from Beat 19, 1:30–2:15

### 6.4 Maya responds in Reflection mode
- Switch to **Reflection** mode in the writing surface
- Type a short response in Maya's voice — why did "class solidarity" stay in the notes? Does she want it in the draft now? (Use the sample from **Beat 13, Reflection mode** as a guide)
- Click **Submit** → a new turn lands, AnnotationsRail may surface a follow-up
- **Say:** "The activity of reasoning stays Maya's. The system makes it tractable."

> ⚠ **Today:** the auto-opening side-by-side comparison surface (notes excerpt + draft passage rendered together when Maya clicks a cross-document observation) is roadmap F3. The cross-document beat today lands through the *prompt text itself* — the AI's question already names both surfaces.

---

## Phase 7 — Composer artifacts (resolution / range, 2:15–2:45)

**Feature: artifact composer, intents (discussion_prompt, scaffold, feedback_letter, study_guide, presentation, …), source_scope, audience, A2UI spec output.**

### 7.1 Mr. Okafor generates a discussion prompt
- Sign in as Mr. Okafor (or swap tab)
- Navigate to `/new-artifact`
- Intent: `discussion_prompt`
- Scope: Lesson 3
- Audience: class
- Prompt: *"give me 3 discussion questions for tomorrow that push past 'both are right in their own way'"*
- AI emits → confirm output matches **Beat 16 (Discussion-prompt artifact)** or paste it in

### 7.2 (Optional) Maya generates a study guide
- Swap to Maya; navigate to `/new-artifact`
- Intent: `study_guide`
- Scope: her project (Lesson 3)
- Audience: self
- Prompt: *"study guide for me, based on what I've worked through"*
- AI emits → match **Beat 17 (Study-guide artifact)**

> ⚠ **UI gap:** if `/new-artifact` doesn't actually call an LLM, the composer's output may need to be pasted manually into the resulting artifact view. Beats 16/17 are paste-ready.

---

## Phase 8 — Composed reading as the across-time artifact + close (2:45–3:00)

**Features: composed teacher's reading carries the trajectory in its RESOLVED section. Progression view is roadmap.**

### 8.1 Re-open the composed reading
- From `/teacher/student/student_maya`, walk back through the four-part reading
- Highlight the RESOLVED section in particular — it carries the across-time trajectory
- **Talking point** from Beat 19, 2:15–2:45

> ⚠ **Today:** `/progression` 404s; persisted across-time narratives (Beat 10) are roadmap F7. `progressions` table and `composeProgression` action exist, but the route doesn't. Until F7 lands, the composed reading's RESOLVED section is the current substitute — it carries the trajectory in prose.

### 8.2 Close on the class view
- Back to `/teacher`
- Implied scale: 30 students × 6 lessons × 1 teacher
- **Final talking point** from Beat 19, 2:45–3:00

---

## What's there today vs. on the roadmap

Honest state of the app, by feature. Roadmap items match `demo/build-prompts.md` (F1–F15) for delegation.

### ✅ Working today
- Login picker (Mr. Okafor + Maya); signup flow at `/signup`
- Course creation form + enrollment (`createCourse`, `enrollInCourse`)
- Lesson editor Plan View — sortable block list, block cards, private-note slot, delete-block, delete-lesson, **Preview Mode** toggle
- Reading Doc Editor (TipTap) with **Generate Panel** — paragraph / chart / diagram, each with provenance footer and "Show data" disclosure
- Real Vega-Lite charts via react-vega in reading docs (this IS the data-chart feature)
- **ChatPanel** on the lesson editor — teacher↔AI chat, suggested-action one-click apply (`sendChatMessage`, `applyChatSuggestedAction`)
- Three-mode student writing surface (Notes / Draft / Reflection) with `saveWorkingText` auto-save + `submitTurn` LLM ingestion
- `AnnotationsRail` surfacing observations chronologically from `turn-call`
- Composed teacher's reading via `composeReading` action on `/teacher/student/[id]`
- Teacher annotations via `submitAnnotation`
- Video blocks via `saveVideoUrl` + `VideoPlayer`

### 🚧 Roadmap (see `demo/build-prompts.md`)
| Feature | Build prompt |
|---|---|
| Widget palette (Citation / Claim-with-Support / Counter-Argument / Comparison) on the student surface | F1 |
| Engage / Dismiss state on AnnotationsRail observations | F2 |
| Auto-opening cross-document comparison surface when engaging a cross-document observation | F3 |
| Sentence / paragraph anchors on observations | F4 |
| Refresh button on the composed reading | F5 |
| Class-summary composer wired to the dashboard (currently hardcoded copy) | F6 |
| `/progression` route (persisted across-time narrative) | F7 |
| Preview Mode polish | F8 |
| Chat suggested-action round-trip polish | F9 |
| Generate Panel — three sub-kinds end-to-end | F10 |
| Chart provenance footer mandatory everywhere | F11 |
| Reflection mode visible affordance | F12 |
| Material-dwell tracking as substrate events | F13 |
| Student-side annotation lifecycle (open → received → responded) | F14 |
| Destructive-action confirms | F15 |

### Fallbacks if a "working today" beat misfires live
- ChatPanel doesn't reply → paste the expected reply from **Beat 20** into the thread
- Generate Panel hangs → paste the segment manually using **Beat 18** values
- `composeReading` returns empty → paste **Beat 9** content into the page
- AnnotationsRail empty after submit → narrate the expected observation from **Beat 14**

---

## Voice reminders

- *Teacher private* (private rubric, pedagogy notes): direct, structural, names failure modes.
- *Teacher to student* (annotation): one or two sentences; a question, not a directive.
- *Student first-person* (notes): informal, self-questioning, MID-thought.
- *Student think-out-loud*: unedited, run-on, self-correcting; less curated than notes.
- *Student draft prose*: AP-essay register, no hedging.
- *AI observational*: observation + question; never declarative ("the answer is …"), never evaluative ("you should …").

---

# Part 2 — Reference appendix (copy-paste payloads)

## Beat 1 — Mr. Okafor creates the course

| Field | Value |
|---|---|
| Title | Industrial Revolution & Modernity |
| Subject | AP World History |
| Term | Fall 2025 |
| Year group | Year 11 |

**Arc seed text:**

> By the end of this unit, I want students to be able to think about industrialization not as a wave of technology that happened to people, but as a set of conditions that produced new forms of political consciousness — and to be specific about which mechanism does which work between conditions and consciousness. The hard question I want them carrying out of the unit is whether "the working class" is a category we discover in the historical record or one that comes into being through the activity of the people who eventually name themselves with it.

---

## Beat 2 — Lesson 3 header fields

**Title:** The Making of the Working Class

**Prompt:**

> Did the Industrial Revolution create the working class, or did the working class create itself?

**Context block** (shown to students):

> This is the third lesson in a six-week unit on industrialization and modernity. Most students arrive holding the slogan "the factory made the workers." The work of the lesson is to take that slogan seriously enough to argue against it — and to take the opposite reading seriously enough to argue against that too. There's no right answer, only a strong one and a weak one, and the difference is whether you actually wrestled with the sources.

**Teacher's note to students** (paired with the prompt):

> There's no right answer to this one. There's a strong answer and a weak answer, and the difference is whether you've actually wrestled with the sources or just picked a side. I want to see you take the harder reading seriously even if you end up disagreeing with it.

---

## Beat 3 — Three materials (paste as reading blocks)

### Material 1 — Hebergam testimony (primary source · 1832)

```
Testimony of Joseph Hebergam, age 17, before the Sadler Committee, 1832.

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

[Editorial note: testimony abridged for length. The Sadler Committee gathered hundreds of similar accounts in 1832 as part of the parliamentary inquiry that led to the Factory Act of 1833.]
```

**Source line:** Parliamentary Papers, House of Commons, 1832 (abridged)

---

### Material 2 — E.P. Thompson (secondary source · 1963)

```
From E.P. Thompson, The Making of the English Working Class, 1963 (condensed).

Thompson argues that the working class was not simply produced by the steam engine and the factory. The factory produced workers — but workers are not yet a class. A class exists when people who share a common situation come to recognize that they share it, name themselves, and act together on the basis of that recognition. This is a process, not an event, and it is the work of the workers themselves: in their meetings, their pamphlets, their songs, their strikes, their funerals. Between roughly 1790 and 1832, English working people moved from being a collection of trades and locales — weavers in Lancashire, miners in Durham, artisans in London — into something they began to call, in their own writing, the working class. The economic conditions were the soil. The class was the plant. Soil does not grow itself; the plant does that work.
```

**Source line:** E.P. Thompson, *The Making of the English Working Class* (1963)

---

### Material 3 — Friedrich Engels (counter-source · 1845)

```
From Friedrich Engels, The Condition of the Working Class in England, 1845 (condensed).

Engels, writing as a young man living in Manchester, describes the workers he sees not primarily as agents but as products. The factory system, he argues, creates the proletariat by stripping workers of the property, the craft skills, and the village ties that once gave them an independent footing. What is left is a population of human beings who own nothing but their capacity to labor and who must sell that capacity, daily, to whoever will buy it. Their misery is not incidental to industrial capitalism — it is constitutive of it. Whether or not the workers understand themselves as a class is, for Engels, secondary; the structural fact of their position is what matters, and that position was made for them by the iron logic of the factory.
```

**Source line:** Friedrich Engels, *The Condition of the Working Class in England* (1845)

---

## Beat 4 — AI-generated chronology block (teacher curates this)

```
From factory system to working class, 1760–1832 — a chronology.

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

1963: E.P. Thompson publishes The Making of the English Working Class, arguing — against the structural reading Engels exemplifies — that the class made itself through political activity, not just through being subjected to economic conditions.
```

**Source line:** E.P. Thompson, *The Making of the English Working Class* (1963); Eric Hobsbawm, *The Age of Revolution* (1962); Sidney & Beatrice Webb, *History of Trade Unionism* (1894); Parliamentary Papers, House of Commons.

---

## Beat 5 — Mr. Okafor's private rubric

Pasted into the *response* block as a teacher_note — not shown to students.

```
EXPECTED DIMENSIONS (private rubric, not shown to students):

1. Engages with the distinction between economic conditions and political consciousness — does not collapse them.
2. Uses at least one primary and one secondary source. Both are present in the materials.
3. Acknowledges that "the working class" is a contested category, not a given. The strong answers name the contestation; the weak ones treat the term as natural.
4. Takes a position rather than hedging. "Both are right in their own way" is the weakest move and the most common.
```

---

## Beat 6 — Maya logs in and works on her project

### Note 1 — pre-edit (the naïve version, after reading Hebergam)

> The Hebergam testimony is brutal. Seven years old. His brother died at fourteen. This proves the workers were victims of the factory.

### First draft paragraph — ~85 words, "victims of the factory" framing

> The factory took everything from the workers. They went in at five in the morning and came out at eight at night, fifteen hours, with forty minutes for lunch and nothing else. Children started at seven years old. They were beaten if they slowed down. Their bodies were bent permanently by the work — Joseph Hebergam testified that his knees were turned inward and his brother had died at fourteen from the same labor. The workers were victims of the factory in every sense that the word can mean.

> [Live demo beat — AI surfaces Observation 1: "Victims of what, exactly?"]

### Note 1 — rewritten after Maya engages the observation

> The Hebergam testimony is brutal. Seven years old. His brother died at fourteen. I keep wanting to write that this proves the workers were victims of the factory but I think Mr. Okafor is going to push back on that. Victims of what exactly? Just the machines? The owners? The whole system?

---

### Note 2 — Session 2, after reading Thompson

> Read Thompson today. The "soil and plant" thing is sticking with me. He's saying the workers MADE THEMSELVES into a class, which is wild because everything else I've read makes it sound like the factory made them. Need to figure out which one I think is right.

### Note 3 — Session 3, after reading Engels (first use of "class solidarity")

> Engels makes the opposite case from Thompson basically. For Engels the workers are products. For Thompson they're agents. Both are looking at roughly the same period. So how do they disagree? I think it's about consciousness — Engels thinks the structure makes the class whether the workers know it or not, Thompson thinks the class only exists once the workers see themselves that way. This feels like class solidarity vs. class condition. Need to think about which one I'm arguing for.

### Note 4 — Session 4, today

> Going back to the draft. I think I'm landing on Thompson but I want to take Engels seriously.

---

## Beat 7 — Maya's full ~600-word draft, paragraph by paragraph

### Para 1

> The Industrial Revolution transformed Britain between 1760 and 1840, reshaping how people lived and worked. Mills and factories replaced cottage industries, drawing workers into cities in unprecedented numbers.

### Para 2

> These changes did not happen in a vacuum. Workers experienced exhaustion, injury, and displacement. Something changed in how they understood their situation — not just as individuals, but as a group.

### Para 3

> The Sadler Committee testimony of Joseph Hebergam, a seventeen-year-old factory worker in 1832, shows how brutal the conditions were. Hebergam started working at age seven, doing fifteen-hour shifts with only forty minutes for meals. He was beaten when he slackened. His knees were bent permanently from the labor. His brother died at fourteen from the same kind of work. Testimonies like Hebergam's were collected by the hundreds and led to the Factory Act of 1833.

### Para 4

> But the Factory Act didn't happen on its own. Workers had to organize and demand it. This is where E.P. Thompson's argument becomes important. Thompson says that the working class wasn't just created by the factory system — it created itself, through meetings, pamphlets, strikes, and the slow process of workers coming to see themselves as a class with shared interests. The economic conditions were the soil, but the class was the plant, and the plant grew itself.

### Para 5

> This shift in political consciousness is what made the Factory Act possible. Workers didn't just suffer; they organized. They wrote pamphlets and marched and went on strike. They began to understand themselves as having something in common with workers in other towns and other trades. By 1832 there was something that could be called a working class — not just a lot of poor people, but a group with a shared identity and shared political demands.

### Para 6 — closing question

> But what exactly changed? And why in this period?

---

## Beat 8 — Mr. Okafor's two annotations on Maya's reading

### Annotation 1 — anchored to Maya's "victims of what" note

**Excerpt:**

> Victims of what exactly? Just the machines? The owners? The whole system?

**Body:**

> This is the right question. Stay with it. The strongest essays in this unit will be the ones that answer it precisely.

---

### Annotation 2 — anchored to the Thompson paragraph in her draft

**Excerpt:**

> The economic conditions were the soil, but the class was the plant, and the plant grew itself.

**Body:**

> You're getting at something real here. Push the Engels reading harder before you commit. What would Engels say about the line "the plant grew itself"? He might not buy it.

---

## Beat 9 — The composed teacher's reading

What Mr. Okafor sees when he clicks into Maya's project. The composer takes her substrate (notes, draft, observations) and emits a four-part read-back. Sentence-level anchors back to the substrate; the teacher can hover any line to see what it's citing.

**RESOLVED**

> Maya has moved from a flat "workers were victims of the factory" framing into the conditions-vs-consciousness distinction. Her engagement with Thompson is genuine — the notes from October 12 show her actually wrestling with the soil-and-plant metaphor rather than just citing it. By October 15 she is articulating the distinction in her own terms: "Engels thinks the structure makes the class whether the workers know it or not; Thompson thinks the class only exists once the workers see themselves that way." This is the move from describing conditions to thinking about consciousness, and it's hers.

**IN PROGRESS**

> Her current load-bearing position is Thompson-aligned: the working class made itself through political consciousness, with the Factory Act of 1833 as the load-bearing piece of evidence. The Hebergam testimony grounds the conditions Thompson's workers were responding to. The position is defensible. The vocabulary, however, is forming behind the activity rather than ahead of it — "class solidarity" is sitting in her notes but has not made it into the draft.

**UNADDRESSED**

> She has not engaged Engels. The source is in her materials and she's read it (her October 15 notes explicitly contrast Engels with Thompson) but the draft does not cite or address him. Right now she's siding with Thompson by default rather than by argument. The strongest version of her current position requires her to take the Engels reading seriously and explain why she's choosing Thompson — anything less is the "qualified position that names two mechanisms but can't say which is load-bearing" failure mode.

**RECOMMENDED NEXT**

> Ask her to push on the fresh observation about "what exactly changed in how they understood their situation." Pushing on it should bring her to the language her notes are already groping toward — class solidarity — and once that vocabulary is in the draft, the missing engagement with Engels becomes legible to her as a question rather than an absence.

---

## Beat 10 — The progression view (across-time narrative)

What the progression view says when Mr. Okafor opens it for Maya. Same composer, different shape — the trajectory rather than the snapshot.

> Two weeks ago, Maya was treating "the workers" as undifferentiated victims of "the factory." Her draft and notes from October 8 collapsed economic conditions and political consciousness into a single category — workers suffered, therefore workers were a class.
>
> The shift came on October 12, when she read Thompson. Her notes from that session show her registering, for the first time, that there's a distinction between being in a shared situation and recognizing that one is in it. She didn't have language for the distinction yet — she wrote "the workers MADE THEMSELVES into a class, which is wild" — but the conceptual move had happened.
>
> By October 15 she was articulating the distinction in her own terms: "Engels thinks the structure makes the class whether the workers know it or not; Thompson thinks the class only exists once the workers see themselves that way." This is the move where her reasoning shifted from describing conditions to thinking about consciousness.
>
> Today she is using the phrase "class solidarity" — in her notes, not yet in her draft — to name what Thompson is pointing at. The vocabulary is forming behind the activity, which is the right direction. The work that remains is to bring that vocabulary into the draft and to take the Engels position seriously enough to argue against it rather than ignore it.

---

## Beat 11 — Class summary (top of the teacher dashboard)

The AI surfaces a recurring pattern across the cohort. One paragraph; pattern over census.

**Default:**

> Most of the class can name a mechanism. The recurring move missing is *specificity about which mechanism is load-bearing* — students who name two and can't say which one their position depends on are the productive ones to push next.

**Alternative — if you want a swap on stage:**

> Six students have read Thompson; only two have engaged Engels. The cohort's load-bearing weakness this week is taking the structural counter-reading seriously enough to argue against it rather than ignore it.

**Alternative — narrower:**

> Three students are still in narrative mode — describing what happened — and haven't yet staked out a position. Two are in qualified-mechanism mode: they have a position, but it's hedged. Maya is the closest to a defensible argument that engages both readings.

---

## Beat 12 — Maya's think-out-loud entry

The response block has *think-out-loud enabled*. Maya uses it for unedited stream-of-consciousness, before the prose tightens into draft form. Between sessions 2 and 3, wrestling with Thompson before settling on a position.

> OK so Thompson says the workers MADE the class. That's the soil-and-plant thing. But like — what does "made" mean here? Did they wake up one day and decide they were a class? No, that's stupid. So is it gradual? But Thompson keeps acting like it happened in a specific period, 1790–1832. So something happened in that window. What was it? Was it the meetings he keeps mentioning? The pamphlets? Or was it just that there were more of them now, in cities, and they ran into each other and figured out they had the same problem? But that's still kind of the factory doing it, just indirectly. It's the factory bringing them together. Hmm. Unless the political organizing is its own thing. Like Chartism in the timeline — that's POLITICS. That's a movement. People chose to be in it. So maybe the consciousness is when they choose. But you can't choose to be a class — you either are one or you aren't. Right? Or can you? Ugh. I think Mr. O is going to make me decide this. The note I want to write is something like: the factory made the WORKERS but the workers made the CLASS. Conditions vs. organizing. Is that even a real distinction or am I just inventing semantics?

---

## Beat 13 — The three writing modes (Notes / Draft / Reflection)

The student writing surface has three modes. Each persists its own text in `sessions.working_text`. Notes is the think-out-loud register; Draft is the essay register; Reflection is the post-hoc / respond-to-this register.

### Notes mode — sample (Session 3, Maya's voice)

Same as **Beat 6, Note 3**:

> Engels makes the opposite case from Thompson basically. For Engels the workers are products. For Thompson they're agents. Both are looking at roughly the same period. So how do they disagree? I think it's about consciousness — Engels thinks the structure makes the class whether the workers know it or not, Thompson thinks the class only exists once the workers see themselves that way. This feels like class solidarity vs. class condition. Need to think about which one I'm arguing for.

### Draft mode — sample (Session 3, paragraph 5)

Same as **Beat 7, Para 5**:

> This shift in political consciousness is what made the Factory Act possible. Workers didn't just suffer; they organized. They wrote pamphlets and marched and went on strike. They began to understand themselves as having something in common with workers in other towns and other trades. By 1832 there was something that could be called a working class — not just a lot of poor people, but a group with a shared identity and shared political demands.

### Reflection mode — sample (Session 4, live response to Observation 4)

In response to "in your notes you used 'class solidarity' — but your essay doesn't use that term":

> I think I dropped "class solidarity" because it felt like jargon that didn't fit the formal register of the essay. But the more I look at it, the more I realize the phrase is doing real work in my notes that "shared identity" isn't quite carrying in the draft. Class solidarity is what Thompson's workers HAD by 1832 — not just a recognition of shared situation, but a commitment to act on it. I should add it. Maybe in paragraph 5.

> ⚠ **Roadmap (F1):** the widget palette — Citation, Claim-with-Support, Counter-Argument, Comparison — is design-doc, not built. When built, widgets will drop into Draft (or Reflection) mode as structured callouts that anchor to specific sentences/paragraphs. Until then, the three writing modes carry all the load: Notes for the raw move, Draft for the polished register, Reflection for the response to an AI observation.

---

## Beat 14 — The four AI observations (verbatim)

For reference and for typing/fallback when observations should surface.

| # | Surfaced after | Should anchor to | Prompt |
|---|---|---|---|
| 1 | Session 1 submit | First draft paragraph ("victims of the factory…") | Victims of what, exactly? Of the machines, the owners, the system, the times? Different answers point at different arguments. |
| 2 | Session 2 submit | Thompson paragraph | Your draft is focused on male factory workers. Women were a substantial part of the textile workforce — does your argument account for them, or is it about a subset? |
| 3 | Session 4 submit | Paragraph 2 sentence: "Something changed in how they understood their situation" | You write "something changed in how they understood their situation" — what is that change, exactly? Can you name it? |
| 4 | Session 4 submit | Cross-document: notes ↔ draft | In your notes you used the phrase "class solidarity" — but your essay doesn't use that term anywhere. Was that deliberate, or did you leave it out without noticing? |

> ⚠ **Today:** AnnotationsRail shows these chronologically; no per-observation `fresh / engaged / dismissed` state badges (roadmap F2). Sentence/paragraph anchors aren't structured yet (roadmap F4). Narrate Maya's reactions verbally.

**Maya's narrated dismissal reason for Observation 2** (will be a stored field once F2 lands; for now, say it):

> I want to focus on Thompson's argument about consciousness — gender is important but it's not what this essay is about.

---

## Beat 15 — Backboard memory recall (per-student)

Sample queries the teacher can run against Maya's per-student assistant — the semantic profile that's accumulated across her work.

**Q: "What has Maya been working on in this lesson?"**

> Maya is working through Lesson 3 — *The Making of the Working Class*. Across four sessions over two weeks, she has moved from a "victims of the factory" framing toward Thompson's consciousness reading. The Hebergam testimony grounds her account of conditions; Thompson supplies the soil-and-plant metaphor she's using to argue that the working class created itself. She has read Engels but has not yet cited him — the structural counter-reading is sitting in her notes as a contrast she has not engaged in the draft. The phrase "class solidarity" appears in her notes (October 15) but has not made it into her essay.

**Q: "What sources has Maya cited?"**

> Hebergam (Sadler Committee testimony, 1832), Thompson (*The Making of the English Working Class*, 1963), and the Factory Act of 1833. Engels (*The Condition of the Working Class in England*, 1845) has been read but not cited.

**Q: "Where is Maya stuck?"**

> The vocabulary is ahead of the prose — "class solidarity" is in her notes but not her draft. The Engels reading is in her notes but not engaged in the essay. She is currently siding with Thompson by default rather than by argument. The fresh observation (about "what exactly changed in how they understood their situation") asks her to name the change she's gesturing at; engaging it should bring her notes-vocabulary into the draft.

---

## Beat 16 — Teacher artifacts (composer outputs)

The artifact composer takes a teacher's intent + a scope (which lessons, which students) and emits an A2UI spec. Sample artifacts for Lesson 3.

### Discussion-prompt artifact

For tomorrow's class. Scope: `lesson_working_class`. Audience: class.

> 1. Thompson writes "soil does not grow itself; the plant does that work." But the soil isn't passive either — it changes the plant. If a worker's economic conditions limit what kinds of consciousness are possible, is "the plant grew itself" really fair to the soil?
>
> 2. Engels was 24 when he wrote *The Condition of the Working Class in England*. Thompson was 39 when he published *The Making of the English Working Class* — and a century separated them. What changes between someone writing IN a situation and someone writing ABOUT a situation a hundred years later?
>
> 3. The Factory Act of 1833 limited child labor to nine hours a day under thirteen. It was passed by a Parliament that excluded the workers themselves from voting. What does it mean to say workers "made the Factory Act possible" if they weren't the ones who voted on it?

### Scaffold artifact

For a student who is stuck. Scope: their project. Audience: student.

> Try this in order, one paragraph each.
>
> 1. State your position in one sentence. Don't qualify it yet.
> 2. Name one specific source that supports it. Quote a line; explain why it matters.
> 3. Name the strongest counter-reading you can think of from the materials. State the counter as strongly as you can — make it sound true.
> 4. Now decide: does your position still hold? If yes, say what your position has that the counter doesn't. If no, you've found a better position — restate it.

### Feedback-letter artifact

For Maya, end-of-unit. Scope: her full project. Audience: student.

> Maya — your essay has made a real move in the last two weeks. You started by writing that the workers were "victims of the factory" and you ended writing about the working class as a political project. That's the move I most wanted you to make, and you made it on the page.
>
> The next step is the one your notes have already pointed at without your draft catching up. You used the phrase "class solidarity" on October 15. It's the right phrase. It's also the phrase Engels would call sentimental — he'd say what mattered was the structural position, not whether the workers recognized it. Your essay does not yet answer that. The strongest version of your argument requires you to.
>
> I'm not going to grade what you've written yet. I'm going to ask you to revise it once more, with one specific question: would Engels buy the line "the plant grew itself"? If your essay can survive him saying no, you have an argument.

### Other teacher intents (available — ask)

`handout` · `worksheet` · `rubric` · `exemplar` · `mini_lecture` · `assessment` · the cohort-level *progression artifact* (a class-wide narrative across all students for a single lesson).

---

## Beat 17 — Student artifacts (composer outputs)

### Study-guide artifact

For Maya. Scope: her project. Audience: self.

> # Study guide — The Making of the Working Class
>
> **Your position.** The working class made itself through political consciousness, building on the material conditions the factory system created. The Factory Act of 1833 is your load-bearing piece of evidence.
>
> **What you've established.**
> - The factory system created brutal working conditions (Hebergam).
> - Workers, over the 1790–1832 period, came to see themselves as a class with shared interests (Thompson).
> - The Factory Act of 1833 was the political product of this self-recognition.
>
> **What you still owe the reader.**
> - You haven't engaged Engels. He's the strongest counter to your reading. You read him on October 15 but he's not in your draft.
> - The phrase "class solidarity" is in your notes but not your essay. Decide if you want it.
> - The Factory Act was passed by a Parliament that excluded the workers. If the workers "made the Factory Act possible," in what sense did they make it?
>
> **Questions you should be ready to answer.**
> 1. What specifically does Engels think the workers got wrong about themselves?
> 2. What was different about the period 1790–1832 that made class consciousness possible?
> 3. If political consciousness made the Factory Act possible, what made the political consciousness possible?

### Presentation-outline artifact

For an in-class share-out. Eight slides.

> 1. *Did the Industrial Revolution create the working class, or did the working class create itself?*
> 2. **The conditions.** Image: a Manchester mill, c. 1830. One bullet: workers had no choice about whether to work in the factory.
> 3. **The activity.** Image: a Chartist petition. One bullet: workers had a choice about whether to organize, and they did.
> 4. **Hebergam testimony.** Three sentences, my own paraphrase.
> 5. **Thompson.** The soil-and-plant metaphor.
> 6. **Engels.** The counter-reading. (I'm going to argue against him.)
> 7. **My position.** Stated as a single sentence.
> 8. **The hardest question I haven't answered yet.** Where Engels wins.

### Other student intents (available — ask)

`test_prep` · `outline` · `essay_draft` (the polished version of her current draft, with the gaps surfaced as marginal notes).

---

## Beat 18 — Generate Panel prompts (paragraph / chart / diagram)

The Reading Doc Editor has a Generate Panel with three sub-kinds. Each emits a segment with a non-dismissible provenance footer (`teacher_supplied` / `ai_extracted_from_text` / `ai_proposed_from_topic`). The data-chart feature is real — live Vega-Lite via react-vega, with the data queryable via a "Show data" disclosure.

### Paragraph generation — prompts

For the Hebergam reading, expand on the historical context:

> A short paragraph on the Sadler Committee's wider role in 1832 — who served, what kinds of testimony they collected, why the report mattered. Anchor to the materials I already have.

For the Thompson reading, surface the methodological move:

> One paragraph explaining what Thompson means by "making" — is it gradual? agentive? both? Stay close to the soil-and-plant metaphor.

For the Engels reading, set up the dialectic:

> One paragraph on Engels's circumstances in Manchester 1842–44 — what he was doing there, who he was reading, why his observations have the texture they do.

Expect the AI to mark the source as `ai_extracted_from_text` if the prompt grounds in existing materials, or `ai_proposed_from_topic` (with caveat banner) if it reached beyond them.

### Chart generation — prompts

For the chronology block, illustrate urban growth:

> Bar chart: Manchester population at four points — 1771, 1801, 1821, 1831. Data values: 25k, 75k, 108k, 142k. Treat this as teacher-supplied data.

Produces a Vega-Lite bar chart. Provenance footer reads "Teacher-supplied data."

For an AI-proposed chart with caveat:

> Line chart showing the growth of trade union membership in England, 1800–1850. If the materials don't carry the data, propose plausible illustrative numbers and mark the caveat.

Produces a chart with `ai_proposed_from_topic` provenance and a non-dismissible caveat banner ("AI-proposed illustrative data — verify before assigning").

For a chart pulled from the materials:

> A pie chart of the four expected dimensions in the private rubric for this lesson — conditions, consciousness, primary source, counter. Mark each one's importance equally (placeholder); pull the dimension labels from the rubric.

Produces a chart with `ai_extracted_from_text` provenance, citing the rubric/teacher_note source.

### Diagram generation — prompts

For the conditions-vs-consciousness tension:

> A two-column diagram showing the disagreement between Thompson and Engels — left column "conditions / structure" (Engels), right column "activity / consciousness" (Thompson), arrows showing where they agree on facts but split on direction of causation.

For the chronology:

> A horizontal timeline from 1760 to 1850, marking: factory system (1760s), Combination Acts (1799), Luddism (1811–17), Peterloo (1819), Reform Act + Sadler Committee (1832), Factory Act (1833), Chartism (1838), Engels's observations (1842–44).

### What the provenance footer carries

Three kinds, always visible:
- **Teacher-supplied data** — teacher pasted values into the data field. Highest trust.
- **AI extracted from <source>** — pipeline pulled data from a specific material in the lesson. Footer cites the source.
- **AI-proposed illustrative data** — model invented plausible numbers because the materials didn't carry them. Mandatory caveat banner. The "Show data" disclosure lets the teacher audit before assigning.

The "Show data" disclosure is required on every chart — every AI-generated visualization is queryable for its underlying numbers. That's what keeps charts as auditable substrate-derivable artifacts rather than LLM-supplied conclusions.

---

## Beat 19 — Demo arc, scripted (~3 minutes)

The five-segment script with what to say at each beat.

### 0:00 – 0:30 — Open on Mr. Okafor's class view

Eight students visible. Lesson 3 highlighted. Maya's row flagged.

> "Mr. Okafor teaches AP World History. He has thirty students. He cannot read thirty essays in progress every night. What he can do is open Paideia and see, at a glance, where each student's reasoning actually is."

### 0:30 – 1:00 — Click into Maya. The composed reading lands.

> "This is the report card solved correctly. Not a letter grade, not a rubric score — a faithful prose reading of where Maya's reasoning is, derived from her actual work. Mr. Okafor can drill into any sentence."

Hover-click a sentence; the underlying substrate appears as provenance.

> "Every sentence is anchored. The teacher's judgment is what makes meaning here, not the system's."

### 1:00 – 1:30 — Switch to Maya's view

Draft on the left. Notes accessible. Materials in the sidebar. Fresh observation in the right rail.

> "This is what Maya sees. Her draft, her sources, her notes. The AI is not in the foreground."

### 1:30 – 2:15 — The class-solidarity moment

The camera lands on Observation 4 — the cross-document one.

> "Watch what the AI is doing. It's not telling Maya what to write. It's noticing that she used a phrase in one place and didn't pick it up in another, and it's asking her whether that was deliberate. Maya now has to decide. The next move is hers."

Maya reads the prompt — the AI has named the cross-document gap in plain English. Maya switches to Reflection mode and starts to answer: why did "class solidarity" stay in the notes? Does she want it in the draft now?

> "The activity of reasoning stays Maya's. The system makes it tractable."

### 2:15 – 2:45 — Progression view

Switch to the progression view. The narrative composes across time.

> "This is the same kind of derivation, across time. Two weeks ago Maya conflated suffering with class. A week ago she registered a distinction she couldn't yet name. Today she has language for it. This is hexis-formation made legible — the capacity to reason historically, forming through the activity, visible to the teacher in a way that no rubric or letter grade can carry."

### 2:45 – 3:00 — Close on the philosophical claim

Back to the class view. Implied scale: thirty students, six lessons, one course.

> "Paideia is not a tutor. It's not a model of what the student knows. It's the substrate that makes the student's reasoning legible to themselves and to their teacher, while preserving the activity that the reasoning consists of. This is what's been missing for a hundred years of report cards."

---

## Beat 20 — ChatPanel prompts (teacher ↔ AI authoring chat)

The lesson editor's ChatPanel is where Mr. Okafor talks with the AI while building. Replies sometimes carry a structured `suggested_action` (e.g., `create_block`, `tighten_block`) the teacher applies with one click. Thread persists in `teacher_chats`.

### Opening prompts — getting the lesson scoped

> I'm building a lesson on whether the working class made itself or got made. I have three materials in mind: Hebergam testimony, Thompson, Engels. What am I missing?

Expected reply shape (illustrative):
> *Two things to push on. First — students often flatten the timeline between Hebergam's 1832 testimony and Engels's 1845 observations as if they're the same moment, when they're actually a decade apart with the Factory Act in between. Consider an `ai_generated` chronology block. Second — your current materials are all written by or about adult male workers. If your private rubric values engagement with how "the working class" is contested, you may want a fourth source on women in textile mills.*
>
> ▶ Suggested action: **Create an `ai_generated` chronology block** [Apply]

### Refining prompts — the iterative pass

> The Engels excerpt I have is good but too short — students miss the structural argument. Can you tighten the condensed version while keeping it under 200 words?

> What's the strongest counter to a student arguing "both Thompson and Engels are right in their own way"? I want my private rubric to capture that hedge as the weakest move.

### Refresh / regenerate prompts

> Regenerate the chronology to emphasize political organizing — Luddism, Peterloo, Chartism — rather than population growth and mechanization.

> The current context block is too long. Cut it in half and keep the bit about taking the harder reading seriously.

### Suggested-action affordances the AI may surface

- `create_block` — add a new block of a given type at a given position
- `regenerate_segment` — re-roll an AI-generated segment in a reading
- `tighten_block` — shorten an existing block's content
- `add_teacher_note` — surface a private pedagogy note on a specific block

Each surfaces with a one-click **Apply** button. Applying runs `applyChatSuggestedAction`; the lesson editor revalidates; the change appears in Plan View.

### The voice the AI uses

- Observational, not directive — "students often flatten X" rather than "you should add Y"
- References the materials and the rubric by name when proposing changes
- Surfaces tensions rather than resolving them
- Never edits the lesson silently — always proposes via a suggested action the teacher applies

---

## On-demand riffs

When a beat below isn't pre-written, ask in chat with: surface, voice, and length.

- **Other lessons in the unit** — Origins (Why Britain), Factory System, Empire and Industry, Responses (Chartism / Luddism / 1848), Industrial Modernity and Its Discontents.
- **A different student's voice** — emerging / developing / connecting; what their notes and drafts sound like at each stage.
- **A new AI observation, mid-demo** — student just typed X; what does the observer ask?
- **A new ChatPanel exchange** — teacher asks Y, AI proposes Z as a suggested action.
- **A new Generate Panel prompt** — for any of paragraph / chart / diagram, in any reading.
- **A teacher artifact** — handout, scaffold, discussion-prompt, feedback letter, mini-lecture, exemplar, rubric, worksheet, assessment.
- **A student artifact** — study guide, presentation, essay draft, test prep, outline.
- **A backboard recall** — what the per-student or per-lesson assistant returns for a given query.
- **Voice palette** — *teacher private* (Mr. Okafor's pedagogy notes), *teacher to student* (annotation voice), *teacher ↔ AI chat* (collegial, observational), *student first-person* (Maya's notes), *student think-out-loud* (unedited stream), *student draft prose* (the essay register), *student Reflection* (post-hoc, responding to an observation), *AI observational* (question, never directive).
