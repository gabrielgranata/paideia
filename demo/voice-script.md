# Voice script — Paideia demo (ElevenLabs)

Modular narrative pass. Forty clips across seven acts, ~14–16 minutes if read end-to-end, designed to be assembled in any order and dropped where they don't fit. Substrate (Maya's notes, Mr. Okafor's annotations, the AI's observations, the composed reading, the class summary, the composer artifacts) is quoted from the seed data verbatim wherever a clip says so.

Pacing for the TTS:
- Em-dashes mark short pauses; double line breaks mark longer ones.
- Where the narrator quotes Maya, the AI, or Mr. Okafor, a short introducer phrase precedes the quote and a paragraph break carries the cadence shift. No quotation marks needed in the spoken text.
- Calm, working-teacher register. Direct, unhurried. The philosophical commitments are in the clauses, not in the vocabulary — almost no Greek, almost no theorist names. The system describes itself by what it does.

Section headings are markers for chunking generations. They are not in the audio.

---

# Act I — The commitment

## PHIL-1

Mr. Okafor teaches AP World History. He has thirty students. He cannot read thirty essays in progress every night.

But the problem he is facing is older than the workload. It is that the essay is the wrong artifact. The essay tells you what the student wrote down. It does not tell you whether they are forming the capacity to think historically — which is what the unit was supposed to do.

## PHIL-2

This is not speculative.

MIT did an EEG study on writing with AI, and the people writing with the chatbot could not quote the essays they had just submitted — because the cognitive task they had performed was prompting and accepting, not writing. Anthropic's own study, on engineers learning a new library, found that the AI users scored seventeen percent lower on comprehension. About two letter grades. The gap was widest on debugging.

The pattern is consistent across studies. AI configured to complete the work degrades the capacity the work was supposed to form.

## PHIL-3

Reasoning is not a thing you have. It is a thing you do — and you only have it while you are doing it.

A conclusion that someone else handed you is not your reasoning. You can take it up and work on it. But the work is the only place the reasoning lives.

This is the commitment underneath everything else in Paideia. The system surfaces; the student moves. Every time.

## PHIL-4

Architecturally, this means the AI is allowed to do four things, and not allowed to do anything else.

It can surface an observation about what the student wrote. It can ask a question the student has not asked themselves. It can name a tension between two parts of the student's own work. It can flag a perspective the student has not engaged.

It is not allowed to produce conclusions. It is not allowed to write the student's reasoning. It is not allowed to silently edit the student's work. The constraint is in the schemas, not in the prompts — there is no field in the system where an AI conclusion could live.

---

# Act II — Building the lesson

## BUILD-1

Mr. Okafor signs in. The dashboard is empty. No students yet, no lessons yet.

What he starts with is the arc — the long-form intent for the unit. He writes it in his own voice.

By the end of this unit, I want students to be able to think about industrialization not as a wave of technology that happened to people, but as a set of conditions that produced new forms of political consciousness — and to be specific about which mechanism does which work.

The arc is what the AI will be seeded with on every surface in this course. Students never see it directly. It is the long-form intent.

## BUILD-2

Course created. The arc is now in the system.

Every AI surface in this course — every observation it surfaces, every artifact it composes — gets that arc as context. It sets the standard for what a strong move in this unit looks like, and what the recurring failure modes are.

The teacher writes intent once. The system holds it everywhere.

## BUILD-3

The lesson editor opens in Plan View.

On the left, a sortable block list. In the middle, the blocks themselves — context, prompt, readings, the response space. On the right, a chat panel where Mr. Okafor talks to the AI as he builds.

Every block carries a private teacher note slot. These are pedagogy notes — what this block is for, what to watch for, what counts as a strong move here. Students never see them. The AI uses them to decide what is worth surfacing.

## BUILD-4

Lesson 3. The Making of the Working Class. The central question, written into the prompt block.

Did the Industrial Revolution create the working class, or did the working class create itself?

There is no right answer to this one. There is a strong answer and a weak answer, and the difference is whether the student has actually wrestled with the sources or just picked a side.

## BUILD-5

Three readings get added to the lesson.

A primary source — Joseph Hebergam's testimony to the Sadler Committee in 1832. He was seventeen, started in the factory at seven, fifteen-hour days, beaten when he slackened. His brother died at fourteen.

A secondary source — E.P. Thompson, 1963, arguing that the working class made itself through its own political activity. The factory produced workers; workers became a class.

And a counter-source — Friedrich Engels, 1845, arguing the opposite. The factory system creates the proletariat by stripping workers of everything else. Whether they recognize it or not is, for Engels, secondary.

Three readings, three positions, no agreement. The student has to do the work.

## BUILD-6

Inside one of the readings, Mr. Okafor opens the Generate Panel and asks the AI to compose a short paragraph on the historical context.

The AI writes the paragraph and drops it into the document with a non-dismissible footer. The footer says where the content came from. AI extracted from materials in this lesson. AI proposed from the topic. Or teacher-supplied. Three kinds of provenance, always visible.

The teacher decides whether to keep, regenerate, or delete. The AI's contribution is never silent.

## BUILD-7

The headline feature is in the same panel — chart generation.

Mr. Okafor types a brief: bar chart of Manchester's population in 1771, 1801, 1821, 1831. The AI emits a live Vega-Lite chart that renders into the document. The provenance footer reads: teacher-supplied data.

If the data had come from the materials, it would say so and cite the source. If the AI had invented illustrative numbers because the materials did not carry them, a caveat banner would appear and the chart would carry the warning until the teacher verified.

Every chart has a "show data" disclosure. The numbers are auditable. Charts in Paideia are derivations, not LLM-supplied conclusions — the difference is structural.

## BUILD-8

On the right, the chat panel.

Mr. Okafor types: I'm building a lesson on whether the working class made itself or got made. I have three readings — Hebergam, Thompson, Engels. What am I missing?

The AI replies, observationally. Students often flatten the timeline between Hebergam in 1832 and Engels in 1845, when the Factory Act sits in between. It offers a suggested action: create an AI-generated chronology block. Mr. Okafor clicks Apply. The block appears in the lesson.

The AI proposes; the teacher applies. No silent edits. The teacher stays the author.

## BUILD-9

On the response block — where the student will write — Mr. Okafor adds a private rubric. Students never see it.

Engages with the distinction between economic conditions and political consciousness; does not collapse them. Uses at least one primary and one secondary source. Acknowledges that "the working class" is a contested category. Takes a position rather than hedging — "both are right in their own way" is the weakest move and the most common.

This is what the AI will read when composing what Mr. Okafor sees about each student. The judgment is the teacher's; the rubric makes it portable.

## BUILD-10

Mr. Okafor toggles to Preview Mode.

The middle column now renders the student-facing lesson exactly as a student would see it. The left column still shows the block structure he authored. The right column shows the private notes and the rubric, labeled: not visible to student.

He is looking at his own lesson from inside it. Checking what is surfaced, what is hidden, what the student lands on first.

---

# Act III — Maya does the work

## WRITE-1

Sign out. Sign in as Maya.

Three columns. On the left, the materials — Hebergam, Thompson, Engels, the chronology Mr. Okafor accepted. In the middle, the question and the writing surface. On the right, an observations rail — empty for now.

The AI is not in the foreground. There is no chat box. There is no "help me write this." The largest, brightest element on the screen is the empty space where Maya is going to write.

## WRITE-2

The writing surface has three modes.

Notes — the private workspace, the think-out-loud register, sentence fragments and questions to herself.

Draft — the essay register, polished prose, what the reader will see.

Reflection — post-hoc, after she has been working: what changed, what is still open.

Each mode persists its own text. The same project, three registers. When the AI surfaces an observation, Reflection is where Maya answers it — without leaving the document.

## WRITE-3

Session 1. Maya reads Hebergam. She writes the first draft paragraph.

The factory took everything from the workers. Children started at seven years old. They were beaten if they slowed down. The workers were victims of the factory in every sense the word can mean.

She submits.

## WRITE-4

The observation lands in the rail on the right.

Victims of what, exactly? Of the machines, the owners, the system, the times? Different answers point at different arguments.

That is the AI's voice. Observational. In question form. It has not told Maya what to do. It has named what her sentence has not yet decided.

## WRITE-5

Maya does not change the draft right away. She opens her notes and writes:

The Hebergam testimony is brutal. Seven years old. His brother died at fourteen. I keep wanting to write that this proves the workers were victims of the factory but I think Mr. Okafor is going to push back on that. Victims of what exactly? Just the machines? The owners? The whole system?

The system surfaced a question. Maya has started to answer the question Maya is now having with herself.

## WRITE-6

Watch what happens when the AI gets it wrong.

Maya is in Session 2. The Thompson reading has just landed. The AI surfaces an observation: your draft is focused on male factory workers. Women were a substantial part of the textile workforce — does your argument account for them, or is it about a subset?

Maya reads it. She decides — not the system — that gender is important but it is not what this essay is about. She sets the observation aside and continues with the consciousness argument.

This is the design working. The AI proposed; Maya deliberated; the next move was hers. The system can suggest what is worth thinking about. It cannot think for her.

## WRITE-7

Session 3. Maya is wrestling with Thompson and Engels in her notes — unedited, mid-thought.

OK so Thompson says the workers MADE the class. But — what does "made" mean here? Did they wake up one day and decide they were a class? No, that's stupid. So is it gradual? But Thompson keeps acting like it happened in a specific period. So something happened in that window. What was it?

This is the substrate at its most valuable. Not the polished sentence in the draft, but the move underneath — Maya asking herself what "made" means. The system catches the move type, not just the prose.

## WRITE-8

Session 4. The live moment in the demo.

The observations rail surfaces a new card. In your notes you used the phrase "class solidarity" — but your essay does not use that term anywhere. Was that deliberate, or did you leave it out without noticing?

The AI noticed a phrase Maya used in one place and did not pick up in another. It is not telling her to add it. It is asking her whether the omission was a choice.

Maya switches to Reflection mode and types: I think I dropped "class solidarity" because it felt like jargon. But the more I look at it, the more I realize the phrase is doing real work in my notes that "shared identity" is not carrying in the draft. I should add it.

The next move was hers.

---

# Act IV — Reading the work back

## READ-1

Mr. Okafor signs back in. He clicks into Maya's project.

The composed reading lands. Four sections. Resolved — what Maya has worked through. In Progress — where her current position is, and what is load-bearing. Unaddressed — what she has not yet engaged. Recommended Next — the question worth pushing on.

This is the report card, solved correctly. Not a letter grade. Not a rubric score. A faithful prose reading of where Maya's reasoning is, derived from her actual work.

## READ-2

The Resolved section, in the system's voice.

Maya has moved from a flat "workers were victims of the factory" framing into the conditions-versus-consciousness distinction. Her engagement with Thompson is genuine — the notes from October 12 show her wrestling with the soil-and-plant metaphor rather than just citing it. By October 15 she is articulating the distinction in her own terms.

The reading anchors to specific notes, specific dates, specific moves. It does not characterize Maya. It cites her.

## READ-3

The Unaddressed section names the gap.

She has not engaged Engels. The source is in her materials and she has read it — her October 15 notes contrast Engels with Thompson — but the draft does not cite or address him. Right now she is siding with Thompson by default rather than by argument.

The voice is structural, not evaluative. It names what is and is not on the page. It does not say Maya is wrong. It does not say she is behind. It says what has happened and what has not.

## READ-4

Mr. Okafor hovers over a sentence in the reading.

The substrate underneath surfaces. Specific notes Maya wrote on specific dates. Specific draft passages. Specific observations the AI surfaced and how Maya responded to them.

Every sentence in the composed reading anchors to substrate. Nothing the AI says is unsupported. The teacher's judgment is what makes meaning here, not the system's — but the system shows its work, line by line.

## READ-5

Mr. Okafor writes back to Maya. Two annotations, in the same voice the AI uses — short, in question form, never directive.

The first, anchored to her early note: this is the right question. Stay with it. The strongest essays in this unit will be the ones that answer it precisely.

The second, anchored to the Thompson paragraph in her draft: you're getting at something real here. Push the Engels reading harder before you commit. What would Engels say about the line "the plant grew itself"? He might not buy it.

Five lines of teacher writing, sent back to Maya. The AI surfaced the substrate. The teacher made the judgment.

---

# Act V — The cohort

## COHORT-1

Mr. Okafor returns to the class view.

Five students visible. Maya — developing, flagged. Jordan — proficient. Amir — emerging, still in narrative mode. Sofia — developing and flagged, names two mechanisms but hedges on which is load-bearing. Nia — extending, going beyond the materials.

The stages are not grades. They are a structural read of where each student's reasoning currently is in this unit. The flagged signal is where teacher attention has the highest marginal value.

## COHORT-2

Across the top of the dashboard, a one-paragraph class summary.

Most of the class can name a mechanism. The recurring move missing is specificity about which mechanism is load-bearing — students who name two and can't say which one their position depends on are the productive ones to push next.

Pattern over census. The system surfaces the move that is missing across the class, not the percentage of students at each stage. The teacher gets a question to take into tomorrow's class.

## COHORT-3

Cohort visibility is structural.

Students can see the shape of how others approached the same prompt — what move types appeared, what counter-readings got engaged, where the class diverged. They cannot see other students' prose.

It is how the platform stays a community without becoming a copying surface. Each student does their own work; the structural visibility is what lets them know they are not alone in it.

## COHORT-4

The system aggregates labor without automating judgment.

Mr. Okafor still reads. He still writes the annotations. He still decides what tomorrow's class is going to push on. What the substrate does is sort the thirty essays so he can spend his evening on the four students where his reading does the most work.

---

# Act VI — Composition

## ART-1

The composer takes a teacher's intent and a scope, and emits a derivation from the substrate. Same substrate, different audiences.

A discussion prompt for tomorrow's class. A scaffold for a student who is stuck. A feedback letter at end of unit. A study guide for a student to work from. A presentation outline. A worksheet. A mini-lecture.

Every artifact is composed from the substrate underneath. The composer never invents content; it derives.

## ART-2

Mr. Okafor asks for three discussion questions for tomorrow that push past "both are right in their own way."

The composer returns this one.

Thompson writes "soil does not grow itself; the plant does that work." But the soil isn't passive either — it changes the plant. If a worker's economic conditions limit what kinds of consciousness are possible, is "the plant grew itself" really fair to the soil?

The question does not tell students what to think. It names a tension Thompson glossed over. It is the AI's voice the students will hear in class.

## ART-3

End of unit. Mr. Okafor asks the composer for a feedback letter for Maya.

Maya — your essay has made a real move in the last two weeks. You started by writing that the workers were victims of the factory, and you ended writing about the working class as a political project. That is the move I most wanted you to make, and you made it on the page.

The next step is the one your notes have already pointed at without your draft catching up. You used the phrase "class solidarity" on October 15. It is the right phrase. Engels would call it sentimental — he would say what mattered was the structural position, not whether the workers recognized it. Your essay does not yet answer that.

I'm not going to grade what you have written yet. I'm going to ask you to revise it once more, with one specific question: would Engels buy the line "the plant grew itself"?

The letter is composed from Maya's substrate. Mr. Okafor reads it, edits one line, and sends it.

## ART-4

Maya, working from the other side, asks the composer for a study guide for herself.

What you have established. The factory system created brutal working conditions — Hebergam. Workers came to see themselves as a class with shared interests — Thompson. The Factory Act of 1833 was the political product of this self-recognition.

What you still owe the reader. You have not engaged Engels. He is the strongest counter to your reading. The phrase "class solidarity" is in your notes but not your essay. Decide if you want it.

The study guide is structurally honest. It tells Maya where her own reasoning is — not where she should land.

## ART-5

Provenance is preserved at the move level.

No AI-generated text is silently incorporated into the student's reasoning artifact. The teacher view can always distinguish what the AI surfaced from what the student wrote. The student view can too.

Every artifact carries that history. The composer never resets the record.

---

# Act VII — Close

## CLOSE-1

Across time. The same composer, different shape.

Two weeks ago, Maya was treating workers as undifferentiated victims of the factory. A week ago, she registered a distinction she did not yet have language for. Today, she has a phrase — class solidarity versus class condition — that names the move she is making.

This is the capacity to reason historically, forming through the activity, visible to the teacher in a way no rubric or letter grade can carry.

## CLOSE-2

Four tests. Every feature in Paideia has to pass them.

Did the student make the next move, or did the system make it. Is there a queryable trace in the substrate the teacher can drill into later. Did the AI stay peripheral while the student worked, or did the student have to leave the writing to talk to the AI. And — the long one — would a student who worked this way for a semester reason better off the platform, or worse.

The fourth one is the only one that ultimately matters. It is the one most current AI tools fail.

## CLOSE-3

Two pieces of evidence carry the weight here.

The argument-mapping research: when students work in a structured representation of their own reasoning, the gain on critical-thinking tests is roughly four-fifths of a standard deviation. The largest documented intervention in the literature. The substrate in Paideia is an argument map.

And the Anthropic study again. The only AI-use pattern that preserved learning was active questioning and explanation-seeking. Wholesale delegation produced the seventeen-percent comprehension deficit. Paideia's loop is the engaged-questioning pattern, by design.

The case is no longer speculative. The pattern that preserves the capacity is the one Paideia operationalizes.

## CLOSE-4

Paideia is not a tutor. It is not a model of what the student knows.

It is the substrate that makes the student's reasoning legible to themselves and to their teacher — while preserving the activity that the reasoning consists of.

This is what's been missing for a hundred years of report cards.
