# What Teachers Actually Do

**Field research for Paideia · July 18, 2026**

*Method: a 37-agent research workflow — 8 parallel researchers over distinct dimensions of teacher practice, adversarial verification of each dimension's load-bearing claims (24 verified: 17 confirmed, 3 plausible, 4 refuted-and-corrected), a completeness critic, and 4 follow-up researchers on the critic's gaps. ~1.85M tokens, 749 tool calls. Findings mix authoritative sources (RAND, NCES, Gallup, BC Ministry primary documents — several read in full PDF) with first-person teacher accounts (blogs, r/Teachers, r/CanadianTeachers, BCTF surveys). Every claim below carries its source; corrected claims appear in §4 so nobody ships the wrong version.*

---

## The short version

1. **Teachers assemble; they don't author from scratch.** The average teacher runs 2 core curricula + 5 supplemental resources; only 7% of high-school teachers use a single curriculum by-the-book; 51% of HS teachers primarily teach from self-created materials, and secondary humanities is the most DIY segment of all (85% of US history teachers use self-written materials). *Paideia's editor competes with the teacher's Google Drive folder, not with Pearson.* [RAND RRA134-30; AHA American Lesson Plan — both verified against primary PDFs]
2. **The formal lesson plan is a compliance artifact teachers resent.** The operative plan is the slide deck, planner grid, phone notes — the *student-facing delivery material*. NYC's union contract literally bars admin from mandating plan formats. A lesson editor that produces the thing students see is investing where teachers invest; one that produces a "lesson plan document" builds the resented artifact. [Verified: UFT Art. 8; ASCD; teacher first-person]
3. **Feedback capacity is the binding constraint on writing frequency — and always was.** ~10 min/essay grading; a single assigned essay = 15–25 hours across sections. Teachers say it outright: *"I can't have them write two paragraphs every day because that will take me how much time to read."* Meanwhile 81% of students spend ≤15 min with written feedback, and a visible grade suppresses attention to comments. The after-the-fact feedback channel is largely dead; practitioner innovations that work (delayed grade, conferencing) move feedback into a live moment. [Applebee & Langer 2011 primary PDF; Crisp 2007; CEP 2025 n=937; Louden; Sztabnik]
4. **Extended argumentative writing is rarer than anyone assumes** — ~19% of collected assignments were a paragraph or more (in schools *selected for* writing emphasis), roughly one substantial piece per month/unit in humanities — **and post-AI it moved to supervised conditions, not to paper.** 65% of assignment-changing teachers use in-class typing with Wi-Fi cut; English departments run essays inside lockdown browsers on Chromebooks; the teacher-designed pattern is a *stakes split* (high-stakes in-class/supervised, low-stakes formative flexible). BC's own Grade 10/12 graduation literacy assessments are typed, on-screen, extended written response in a secure browser — the province's high-stakes format *is* Paideia's modality. [Applebee & Langer; intelligent.com n=228; NYT/Goldstein 2026; BC assessment specs]
5. **AI generation is already commoditized at $0.** MagicSchool ~6M signups, Brisk 1M+ teachers (1 in 5 US teachers has the extension), Gemini free in Workspace, ChatGPT for Teachers free to 2027. The #1 teacher AI use is *re-leveling existing text*, not de-novo generation — and teachers call AI-generated lesson content "trash" while loving AI for paperwork. Generation is table stakes; **provenance and the student reasoning loop are the parts the incumbents structurally lack.** [Gallup 2025; MagicSchool Wrapped; r/Teachers]
6. **Process provenance is already a mass teacher behavior — as forensics.** ~1.7M+ teachers mine Google Docs version history (Draftback, Revision History, Brisk Inspect Writing); Grammarly Authorship generated 2M reports in two months. But it's an arms race (typing-simulator extensions, TikTok bypass tutorials) and a surveillance flashpoint. The open lane is **provenance by design** — the reasoning process as the visible artifact from the start — and it must be legible as *"observes to question," not "monitors to flag,"* because students' school accounts are already scanned 24/7 by safety software with high false-positive rates. [EdSurge; CDT; activehistory.ca]
7. **The BC beachhead inverts US edtech instincts.** Surrey, Vancouver, Coquitlam run on **Microsoft Teams**, not Google Classroom (Island districts lean Google — dual SSO is mandatory). Student hardware is **BYOD + bookable carts**, not 1:1 Chromebooks; VSB's own budget admits device access is inadequate. Report-card marks are **hand-keyed into MyEducation BC** regardless of LMS. And bottom-up freemium is structurally throttled: districts gate every tool on a FOIPPA Privacy Impact Assessment, and SD61 states individual teacher requests *"are not able to be prioritized."* The efficient path: one lighthouse district PIA, propagated through Focused Education Resources' shared PIA directory (BC/Yukon/NWT). [All verified against district primary sources]
8. **BC's reporting policy contains a structural wedge:** a digital portfolio can legally *be* a required written Learning Update (report card) if it carries proficiency indicators + teacher growth feedback + student self-reflection on Core Competencies. K–9 uses the four-point proficiency scale (never emit percentages); Grades 10–12 **keep letter grades and percentages** plus now-mandatory descriptive feedback. The BCTF's stated tooling demand: evidence must transfer to MyEd automatically or it's workload. [Ministry FAQ read in full; verified verbatim]
9. **Individual professional autonomy is a contractual right in BC** (Vancouver Art. F.20: teachers have "individual professional autonomy in determining the methods of instruction, and the planning and presentation of materials"). Department-lockstep workflows normal in US PLC schools could be *grievable* in BC. Multi-teacher features must be opt-in sharing/forking, championed by department heads (real, board-appointed, ~$2–4K allowance, soft power only). Lesson ownership: **law says the board owns it** (work-for-hire; Copyright Act s.13(3)); **custom says the teacher carries it**; the union-blessed BC pattern is teacher-controlled CC licensing (TeachBC). A schema must pick which it encodes. [Verified against SD39 agreement PDF]
10. **Adoption is decided in minutes and killed by logistics.** Two-thirds of teachers decide on a tool in <30 minutes; ~half abandon after ≤3 sessions; the #1 abandonment reason is the free trial expiring (31%), above any quality complaint; students are the usability jury. Districts cut tools at renewal using open-rate telemetry. Survival features veterans test: works when Wi-Fi dies, prints as a sub plan, students all get in within ~2 minutes. [eSpark n≈600; EdSurge post-ESSER; teacher first-person]

---

## 1 · How teachers actually perform their functions

### Planning is assembly at the unit level

US teachers work ~53–54 hrs/week with ~5 median hours of planning happening largely on personal time (school-provided planning averages 4h26m/week and is routinely consumed by meetings) [RAND 2024; NCES 2023]. Secondary humanities teachers plan at the **unit** level — texts, essential question, assessments, calendar — in an hour or two, then fill daily detail continuously, close to delivery [teacher first-person, converging accounts]. Replanning is structural, not exceptional: published curricula contain more lessons than the year has days (documented: 160 lessons vs 148 days), so cutting and resequencing is a weekly act [Instruction Partners].

The modal planning act is **assembly**: RAND's own summary language is "two curriculum materials and five supplemental materials," with ~90% of curriculum users modifying, and the dominant modification being **adding content (58%)**, not cutting (10%). Sourcing runs through Google search, TPT, and subject-community word of mouth — not vetted repositories. Backward design (UbD) is ed-school canon and template vocabulary, but practitioners describe the full framework as "borderline overwhelming"; the lived sequence is calendar-and-texts-first with assessment folded in. **Paideia's prompt-first entry is asking for real backward design — a behavior change wearing familiar vocabulary, not a workflow match.**

In BC: 72.2% of secondary teachers work a semester system; prep time (~1 block in 8) can concentrate in one half of the year ("some teachers go 12 months without any prep time" — BCTF survey verbatim, verified against the primary PDF). New courses spin up **twice a year**; onboarding calibrated to a September-only cadence misses half the entry points.

### Writing instruction in humanities

- **The frames are universal; the confidence isn't.** CER, RACE/ACE, and They Say/I Say are the lingua franca of paragraph-level argument, often adopted school-wide [verified]. But only **28% of non-ELA secondary teachers** strongly agree they know what good writing instruction looks like vs 64% of ELA teachers [RAND RR2575z14, verified]. *A history-first writing tool must carry the writing pedagogy itself.*
- **The DBQ Project's 6-step method** — the de facto standard for document-based writing — inserts an oral **"thrash-out" debate step** between document analysis and essay writing. Talk-before-writing is designed in, not optional. Paideia currently has no place for the talk step.
- **AP operationalizes argument as a 7-point binary checklist** scored in 2–3 minutes/essay; classrooms teach to it. "Argument quality" in the wild is discrete earnable points.
- **BC's social studies curriculum is built on Seixas's six Historical Thinking Concepts** (evidence, significance, cause/consequence, continuity/change, perspective, ethical judgment — developed at UBC). The province's mandated standards are already phrased as *reasoning moves over sources*. Paideia's substrate roles should speak this vocabulary; it will read as curriculum-aligned rather than imported. Alignment object = **Curricular Competencies**, not topics (content is explicitly flexible; competencies are the mandatory spine).

### The feedback economy

Grading a class set ≈ 4–5+ hours; multiple sections make one essay a 15–25-hour commitment inside a 54-hour week. This — not pedagogy — historically capped assignment frequency, and teachers say so in so many words. On the receiving end: 39% of students spend ≤5 minutes with feedback, 81% ≤15; roughly 58–67% either ignore it or don't improve; a visible grade is an attention terminator (Louden's delayed-grade system exists precisely to fight this; her student: *"I've never read what a teacher writes on my essay before, and now I have to"*). Veteran practice has evolved toward **comment banks** (native in Classroom and Turnitin), **single-point rubrics**, and **live conferencing instead of marginalia** (Sztabnik). The EEF review's conclusion: written feedback produces learning only when class time is set aside to respond to it.

Meanwhile the Google Classroom **Turn-in mechanic structurally fights feedback**: turned-in Docs demote the student to viewer (comments invisible until Return), and Return releases grade + comments simultaneously — the exact condition under which comments go unread.

### Collaboration is shallower than its vocabulary

Meeting-based collaboration is near-universal; co-authorship is rare (44% of teachers never observe a peer's classroom; only ~31% have sufficient collaboration time). Common assessments are frequently an admin mandate that arrives *without* shared planning time — the mandate is departmental, the authoring burden individual. Only ~1/5 of the largest US districts contractually set aside collaborative time. **The unit of authorship — especially in secondary humanities — is the individual teacher**; the department coordinates checkpoints and pacing, not lessons.

### Assessment and reporting in BC (verified in full against Ministry documents)

- Five communications of learning/year (3 written incl. year-end Summary, 2 informal).
- K–9: four-point proficiency scale, no letter grades (IE edge cases exist). 10–12: **letter grades AND percentages retained**, descriptive feedback now mandatory K–12.
- Doctrine: most-recent-evidence over averaging; attendance/participation/behaviour cannot factor into marks. *A US-modeled gradebook does forbidden things by default.*
- Core Competencies are assessed **only** by student self-reflection — teachers do not grade them. (Paideia's reflection mode maps cleanly onto a statutory requirement.)
- **The portfolio clause** (§8 above) is the structural wedge — SpacesEDU built a business on it after FreshGrade (the BC-born category leader) died in 2022, which also means districts have been burned and will ask about data export and vendor continuity.
- 77% of BC teachers opposed the proficiency-scale rollout in the 2021 ministry survey (single-sourced; union president says most have since come around). Assessment-reform fatigue is live; the sore point is **duplicate data entry**, not AI — the BCTF formally demanded auto-transfer to MyEd BC.
- Since 2023–24, every BC graduate needs 4 credits of Indigenous-focused coursework; AI-generated humanities content will be scrutinized for handling of Indigenous content and protocols — provenance-stamping and teacher review are load-bearing here, not nice-to-haves.

---

## 2 · The tools they actually use

### The delivery rails

| Layer | Reality |
|---|---|
| **LMS (US/NA)** | Oligopoly, stable rank order since ~2022: Google Classroom ~31%, Canvas ~24%, Schoology ~19% (ListEdTech, single-source — treat percentages as directional). Don't enter as an LMS; ride the incumbents. |
| **LMS (BC)** | Surrey/Vancouver/Coquitlam = **Teams**; Victoria/Island = Google; D2L Brightspace is the provincial LMS but mandatory only for online schools; Moodle survives in pockets. Daily stack: Teams-or-Classroom + MyEd for marks + paper for whatever the cart lottery misses. |
| **SIS** | PowerSchool #1 US (~23%); BC = **MyEducation BC** (Follett Aspen, provincially hosted, all 60 districts, widely disliked, hand-keyed report marks; some districts don't even enable its gradebook). |
| **Grade flow** | LMS→SIS sync is manual or fragile everywhere. Google put Classroom SIS export behind paid licenses (July 2024). A cottage industry of Chrome extensions exists solely to re-type grades. Teachers treat LMS and SIS as two drifting ledgers. **Don't propose to be a third ledger.** |
| **Classroom integration paths** | Google Classroom has **no LTI**. Free path = share button (no programmatic control, no grades). Everything deeper is paid-tier add-ons. Canvas/Schoology/Brightspace = one **LTI 1.3 + AGS + Deep Linking** build covers them all. |
| **Rostering/SSO** | Clever (vendor pays, six→seven figures at scale) vs ClassLink (vendor free via OneRoster). Google SSO is minimum viable US; **BC needs Microsoft Entra + Google both**. Students have no personal emails; school-managed accounts only; school consents under COPPA as parent's agent (guidance, not codified rule). |

### The materials economy

TPT is the incumbent habit (7M+ educators claimed; 78% of *users* monthly) but skews K–5 and is thinnest exactly at secondary humanities reasoning (64% of most-downloaded HS English units expert-rated not worth using). The real consumption unit is the **fragment** — teachers buy several products to extract "very small pieces" and reassemble. Humanities OER with real reach: Newsela (52% of history teachers), Digital Inquiry Group / Reading Like a Historian (15M+ downloads; the exact sourcing-contextualizing-corroborating heuristics Paideia's substrate should name), DBQ Project (26%), CommonLit (which is deliberately migrating free-library → paid core curriculum, evidence the free-OER model alone doesn't sustain). BC: no provincial resource approval at all — no gate to pass, no catalog for legitimacy; channels are districts, TeachBC, and subject-community word of mouth. Print is rationed (documented: 150 copies/month) — mundane copy limits push digital delivery harder than pedagogy does.

### AI tools (teacher-side)

Adoption is bimodal: 60% touched AI in 2024–25, 32% weekly, 40% never [Gallup, verified]. ELA/humanities teachers are the *heaviest* teacher-side adopters (leveling texts is the killer app) while being most negative about student-side AI (35% of HS teachers say AI does more harm than good). The winners: MagicSchool (~6M signups, 600+ district deployments — but signups ≫ engagement), Brisk (1M+ teachers, rides Google Docs as an extension — the zero-new-tab strategy), Diffit (leveling), plus free platform AI (Gemini, Copilot — the two tools BC districts sanction). Teachers' verdict: **paperwork yes, pedagogy no** ("AI generated lessons have consistently been trash"). Houston ISD's AI-generated district curriculum caused public backlash — *AI-authored-for-teachers* is a different, hated category from *teacher-authored-with-AI*. And a teacher pattern that directly prefigures Paideia: valuing MagicSchool rooms because *"I can SEE what they put in BEFORE the AI product."*

### The writing/integrity stack

NoRedInk (claims 60%+ of districts), Quill, Writable (16K schools, HMH-owned), Turnitin (~17K institutions, ~$203M revenue) — all sentence/paragraph mechanics or integrity; **no incumbent at scale operates on sustained multi-source reasoning.** Social annotation skipped K-12 (Kami's PDF-markup has ~2,000 districts; Perusall/Hypothesis are higher-ed). AI essay-graders are a crowded category (Brisk Targeted Feedback is its most-used tool; AP-rubric DBQ graders abound) — the behavior Paideia's margin meets is not "no AI feedback," it's "AI already writes generic margin comments wholesale."

---

## 3 · What a new tool must build in

**Tier 0 — first-session survival (the 30-minute test):**
- Google **and** Microsoft school SSO; rostered, admin-provisioned access; zero student signup; all students in within ~2 minutes.
- Web app that runs on managed ChromeOS, aging BYOD laptops, and cart machines; graceful degradation when Wi-Fi dies; a print/PDF path (sub plans are a hidden veteran power feature).
- Works in observed 50–75-minute blocks; compatible with lockdown/monitored conditions (the supervised-writing current is the tailwind — swim with it).
- WCAG 2.1 AA (now a DOJ ADA Title II legal requirement for public-school tools); don't block Read&Write-class overlays; read-aloud/translation matter for the ~15% IDEA + ~11% EL population in every class.
- **Fully completable with the AI margin off** — BC consent choreography guarantees some students in every classroom will legitimately run in that state.

**Tier 1 — the district gate:**
- A ready-made **PIA package** for BC (FOIPPA s.69(5)); target one lighthouse district, propagate via Focused Education's shared PIA directory. Surrey approved MagicSchool/SchoolAI/TeachAid for students in Nov 2025 under teacher-granted-access + parent-consent — the choreography exists; Paideia asks for nothing novel.
- US: pre-adopt the SDPC **National DPA** (275K+ executions; converts privacy review into paperwork).
- **No AI training on student data** — named explicitly in the Oct 2025 joint resolution of Canadian privacy commissioners. Canadian data residency: no longer legally required (Bill 22, 2021) but a real trust accelerant.
- Data export and continuity story (BC lived through FreshGrade dying).
- Emit legible weekly-active-classroom telemetry — renewal decisions are made from open-rates.

**Tier 2 — integration sequencing:**
1. **Share-link coexistence** with Classroom and Teams assignments (free, universal, no API risk).
2. **LTI 1.3 + AGS + Deep Linking** — one build covers Canvas, Schoology, Brightspace (and BC's provincial LMS).
3. Google Classroom add-on (paid-tier districts only) later; **never** plan on Classroom LTI (doesn't exist).
4. Grades: accept the two-ledger reality — export CSV, minimize re-key friction; in BC don't promise MyEd sync (no pipe exists; the BCTF demand for auto-transfer is an aspiration the *province* hasn't met).
5. The reporting wedge: a **portfolio-as-Learning-Update export** (proficiency indicator + teacher growth feedback + student Core-Competency self-reflection) — Paideia's artifacts slotting into statutory reporting instead of adding to it.

**Monetization (partially unresearched — see §6):** every leading teacher-AI tool is free to individual teachers; monetization is district enterprise. Teacher out-of-pocket spending is declining. BC throttles bottom-up freemium structurally. The realistic motion: free-for-one-classroom wedge (US) + lighthouse-district PIA (BC) → district contracts. The critic's fifth gap — pricing, budget lines, signing authority — was identified but **not researched** (follow-up cap); it's the biggest open GTM question.

---

## 4 · What adversarial verification corrected

Four load-bearing claims were refuted or materially sharpened — carry the corrected versions:

1. **"36% of history teachers purposefully avoid TPT" → overstated 2–4×.** The AHA figure combines non-use + avoidance; purposeful avoidance alone peaks ~20% (midcareer) and is 9% among new teachers. The anti-TPT identity segment is real but sub-quarter.
2. **"Teachers refuse AI feedback on relationship grounds" → both/and.** The refusal is real (grading/feedback is the least-adopted AI use, ~16%) but rests on **relational AND accuracy** grounds intertwined. Follow-up research sharpened it further: the line is **displacement vs amplification** — teachers accept an AI first-responder when it demonstrably buys more human conferencing; a Socratic-only design doesn't automatically earn exemption.
3. **"AI detection has collapsed; process evidence replaced it" → damaged, not dead.** A visible university cohort disabled Turnitin's detector, but it remains deployed at 10,000+ institutions and new detectors are growing. Process evidence is a fast-growing **complement** favored in teacher-forum practice — not a settled replacement standard — and faces its own surveillance objections.
4. **"Chromebooks are the default NA student hardware" → US-specific, and the numbers were misattributed.** Chromebooks dominate US K-12 (~half of shipments), but the oft-cited stats were stale or unverifiable — and **BC is a split Microsoft/Google province with BYOD + carts**, so the assumption fails precisely in the beachhead.

Also downgraded: the "frozen LMS oligopoly" percentages are single-source (ListEdTech) with internal drift between their own snapshots — structure holds, precision doesn't. The "teachers decide in 30 minutes" finding is a faithful read of a single vendor survey (eSpark) — unrefuted but singly-sourced.

---

## 5 · What this means for the committed design

**Confirmed by the research:**
- **Block editor + assembly-first** matches the real workflow (teachers assemble fragments and add content). Import/adapt flows — paste a found text, clip a PDF, drop a source — deserve first-class treatment *early*, ahead of generation polish. The most-used teacher AI action anywhere is "re-level this existing text" — a strong candidate for the teacher catalog's ◆ group.
- **Provenance-stamped generation** sits exactly between the two documented failure modes (AI bans ↔ Houston-style AI-authored curriculum) and matches an expressed teacher demand ("see what they put in before the AI touched it"). The anti-TPT/quality-conscious segment maps onto it.
- **The student page as the only writing surface, AI beside it**: the BC Ministry's own AI guidance pre-states the thesis ("Education is inherently relational… AI tools should be used as a complement to human processes, not a replacement").
- **Cutting the summoned ◆** was right: the documented failure mode of question-only AI is silent disengagement, and rate-limited summoning wouldn't have fixed that.
- **Serif-for-reading / neutral-for-working** is unaffected by anything found.

**Challenged or needing amendment:**
- **Prompt-first is a behavior change, not a met habit.** Keep it (it's one question, not a UbD framework), but expect it to need selling; the epigraph framing ("the question this lesson serves") is doing persuasion work, not just layout work.
- **Margin comments that arrive after Save & reflect inherit the fate of after-the-fact feedback** — the research's bleakest, best-verified finding. Mitigations worth designing: comments land *during* the session (formative, no grade attached — Paideia already never grades); anchor them to the paragraph; keep them question-shaped and few; and consider a Louden-style structural beat where the next session *opens* on the unresolved margin question. The teacher-facing story must be that the margin **increases human conferencing** (amplification), not that it responds so the teacher doesn't have to (displacement) — that's the documented acceptance line.
- **The lesson doc needs a talk step eventually** — DBQ practice runs oral thrash-out before writing. A future block type (discussion prompt with structured positions), not v1.
- **Move vocabulary should map onto CER/Seixas terms** when the ingest redesign happens — "claim/support/challenge/inquiry" is close but the BC-native and classroom-native words matter for legibility.
- **Session design must fit the supervised-writing regime**: 50–75-minute observed blocks, heterogeneous devices, possible lockdown — not an at-home evening activity. This is a tailwind if embraced (in-class writing is *the* post-AI assessment answer, and the feedback bottleneck it worsens is the one Paideia relieves).
- **The ledger metaphor has a limit**: any proficiency-adjacent output must respect BC doctrine (no averaging, no participation-in-marks, K–9 no percentages) — and never become a third gradebook.

---

## 6 · Honest gaps (not researched or thin)

- **Pricing/procurement economics** (what comparable tools cost per student, which budget line pays, signing authority thresholds, what works when freemium is throttled): identified by the critic, not researched — follow-up cap. Biggest open GTM question.
- No representative data exists on **where lesson plans physically live** (nobody surveys the artifact) or on **K-12's paper-shift magnitude** (the famous blue-book numbers are university bookstore data).
- The 30-minute adoption window and several tool user-counts are **vendor-sourced**; treat as directional.
- Student/parent reception evidence for question-only AI is thin and partly vendor-sourced; the strongest signals: students accept AI-as-thinking-partner *after their own thought exists*, prefer low-social-cost first readers, and the real risk is quiet disengagement — measurable in-product.

---

*Full corpus (152 findings, verification notes, per-agent transcripts): workflow run `wf_68fb1884-eaa`, journal at the session's workflow transcript dir. Formatted extracts were reviewed in full for this synthesis.*
