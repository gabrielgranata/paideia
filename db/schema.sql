-- Paideia substrate + primitives. Hackathon scope.
-- Substrate is ground truth. LLM never writes here directly; deterministic
-- appliers fold structured proposals into nodes/edges.

drop schema if exists public cascade;
create schema public;

create table students (
  id text primary key,
  name text not null,
  -- v0 demo simplification: stage / summary / flagged live on the student
  -- row so the teacher dashboard can render without computing across
  -- substrates. Production should derive these from the underlying nodes
  -- + reading per (student, lesson) instead.
  stage text check (stage in ('emerging','developing','connecting')),
  summary text,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create table teachers (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

-- Course is the 7th visible primitive. It owns an arc — what the teacher
-- wants students to be able to think about by the end. The arc seeds AI
-- context (students never see it directly).
create table courses (
  id text primary key,
  teacher_id text not null references teachers(id),
  title text not null,
  subject text,
  term text,
  year_group text,
  arc_seed_text text,
  -- Class-summary composer cache. The teacher dashboard renders the
  -- ◆ class summary bar from this. Refresh button on the dashboard
  -- triggers a recompose. v0 stores the most recent only.
  last_class_summary jsonb,
  last_class_summary_at timestamptz,
  created_at timestamptz not null default now()
);

create table lessons (
  id text primary key,
  teacher_id text not null references teachers(id),
  course_id text references courses(id),
  title text not null,
  prompt text not null,
  reasoning_shape text,
  source_material_text text,
  expected_kinds jsonb,
  anticipated_gaps jsonb,
  -- Ordered array of blocks; each: { id, type, content, meta?, source? }.
  -- type ∈ {context, reading, video, prompt, response, ai_generated, quiz}
  -- (locked role + open kind discipline as elsewhere in the substrate).
  blocks jsonb,
  -- Map of block_id → private teacher note text. Never visible to student.
  teacher_notes jsonb,
  created_at timestamptz not null default now()
);

create index lessons_course_idx on lessons(course_id);

create table sessions (
  id text primary key,
  student_id text not null references students(id),
  lesson_id text not null references lessons(id),
  status text not null default 'active' check (status in ('active','completed')),
  thread_id text,
  -- The student's working text across three modes: notes (exploratory),
  -- draft (formal), reflection (post-hoc). One jsonb column rather than
  -- three text columns so adding a mode is a render change, not a schema
  -- change. Autosave patches a single key; the explicit Save & Reflect
  -- button reads from here when creating a turn.
  working_text jsonb not null default jsonb_build_object('notes', '', 'draft', '', 'reflection', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

-- Substrate. role is closed (graph operates on it). kind is LLM-proposed
-- descriptor (declarative-generative-UI pattern: bounded creativity).
create table nodes (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  role text not null check (role in ('assertion','support','challenge','inquiry')),
  kind text not null,
  content text not null,
  status text not null default 'open' check (status in ('open','resolved','superseded')),
  created_at timestamptz not null default now()
);

create table edges (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  src_id text not null references nodes(id) on delete cascade,
  dst_id text not null references nodes(id) on delete cascade,
  relation text not null check (relation in ('positive','negative','depends')),
  kind text not null,
  created_at timestamptz not null default now()
);

create index nodes_session_idx on nodes(session_id);
create index edges_session_idx on edges(session_id);
create index edges_src_idx on edges(src_id);
create index edges_dst_idx on edges(dst_id);

-- Raw prose captured before any LLM call so input is never lost.
-- Composed view and gap are the LLM's read-back of substrate, citing nodes.
create table turns (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  raw_prose text not null,
  composed_view jsonb,                 -- A2UI spec: ComposedNarrative cites node_ids
  next_gap jsonb,                      -- { prompt, target_node_ids, type }
  created_at timestamptz not null default now()
);

create index turns_session_idx on turns(session_id, created_at);

create table readings (
  id text primary key,
  student_id text not null references students(id),
  lesson_id text not null references lessons(id),
  derived_content jsonb,
  derived_at timestamptz,
  derived_from_turn_id text references turns(id),
  teacher_annotations text,
  status text not null default 'fresh' check (status in ('fresh','stale','reviewed')),
  unique (student_id, lesson_id)
);

-- Artifacts: generalized substrate read for any owner.
-- Student intents: test_prep, presentation, study_guide, essay_draft, ...
-- Teacher intents: handout, rubric, worksheet, exemplar, mini_lecture,
--   scaffold, discussion_prompt, feedback_letter, assessment, ...
-- Same composer, different intent + scope source. Never a summary;
-- always reasoning organized for the artifact's intent + open questions
-- + unmade connections. Audience says who it's for (self / student / class).
create table artifacts (
  id text primary key,
  owner_type text not null check (owner_type in ('student','teacher')),
  owner_id text not null,
  type text not null,                  -- intent
  title text not null,
  prompt text,
  source_scope jsonb not null,         -- { lesson_ids, student_ids, include_memory, include_documents }
  audience jsonb,                      -- { type: 'self'|'student'|'class', ref_id? }
  spec_json jsonb,                     -- A2UI spec emitted by composer
  -- Composer lifecycle. 'pending' = created but no compose call yet.
  -- 'composing' = LLM call in flight. 'ready' = spec_json populated.
  -- 'failed' = compose failed; spec_json may be null or stale.
  status text not null default 'pending'
    check (status in ('pending','composing','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index artifacts_owner_idx on artifacts(owner_type, owner_id, created_at desc);

create table backboard_scopes (
  scope_type text not null check (scope_type in ('student','lesson','teacher')),
  scope_ref_id text not null,
  assistant_id text not null,
  created_at timestamptz not null default now(),
  primary key (scope_type, scope_ref_id)
);

-- Auth principal. Carries email + role and links to the existing teachers
-- or students row by FK. Hackathon-only: password_hash is nullable; the
-- /login picker reads users by email and sets the cookie. Replace before
-- anyone outside the demo touches the system.
create table users (
  id text primary key,
  email text not null unique,
  name text not null,
  role text not null check (role in ('teacher','student')),
  password_hash text,
  teacher_id text references teachers(id),
  student_id text references students(id),
  created_at timestamptz not null default now(),
  -- Exactly one of teacher_id / student_id is set, matching role.
  check (
    (role = 'teacher' and teacher_id is not null and student_id is null) or
    (role = 'student' and student_id is not null and teacher_id is null)
  )
);

create index users_email_idx on users(email);

-- Many-to-many: students ↔ courses. The teacher decides who's in.
create table course_enrollments (
  course_id text not null references courses(id) on delete cascade,
  student_id text not null references students(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (course_id, student_id)
);

create index enrollments_student_idx on course_enrollments(student_id);

-- Teacher's bylined notes on a student's work. The annotation is an
-- *invitation* — a question the student can only answer from inside their
-- own thinking. Not a grade. Not a correction. Anchored to whatever the
-- teacher is reading: a session, a specific turn, the composed reading,
-- or an artifact. target_id is not FK-constrained because target_type varies.
create table progression_annotations (
  id text primary key,
  teacher_id text not null references teachers(id),
  student_id text not null references students(id),
  target_type text not null check (target_type in ('session','turn','reading','artifact')),
  target_id text not null,
  -- Optional excerpt the annotation is anchored to (for inline rendering).
  excerpt text,
  body text not null,
  created_at timestamptz not null default now(),
  -- Student-side lifecycle: 'open' = unseen; 'received' = student has opened
  -- the page where this annotation surfaces; 'responded' = student has begun
  -- a reflection session in answer to it.
  status text not null default 'open'
    check (status in ('open','received','responded'))
);

-- Teacher × lesson chat thread. One row per (teacher_id, lesson_id) —
-- the teacher's conversation with the lesson-chat composer about that
-- specific lesson. Messages are a jsonb array of {role, content,
-- suggested_action?, created_at}. role ∈ {user, assistant}.
--
-- Discipline: this table is teacher-facing. It NEVER joins to sessions /
-- turns / nodes / edges. The chat is non-substrate-bounded — see
-- src/lib/llm/teacher-lesson-chat.ts. If a future feature wants to
-- surface chat content on the student route, that's an architecture
-- decision and needs its own fidelity audit.
create table teacher_chats (
  teacher_id text not null references teachers(id) on delete cascade,
  lesson_id text not null references lessons(id) on delete cascade,
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (teacher_id, lesson_id)
);

create index teacher_chats_lesson_idx on teacher_chats(lesson_id);

create index annotations_student_idx on progression_annotations(student_id, created_at desc);
create index annotations_target_idx on progression_annotations(target_type, target_id);

-- Progression: across-time narration of a student's reasoning maturation.
-- Composed by the progression LLM call from the student's per-lesson
-- readings + substrate timeline. Two scopes coexist in the same table:
--   • lesson_id is null → course-wide progression (the /portfolio
--     ◆ Development sidebar and the teacher's /progression/[student_id]
--     default view).
--   • lesson_id is set → progression scoped to a single lesson
--     (/progression/[student_id]?lesson_id=…).
-- One row per (student, course, lesson-scope); recompose overwrites.
-- The unique constraint uses `nulls not distinct` so the course-wide
-- row is uniquely keyed even though lesson_id is null.
create table progressions (
  student_id text not null references students(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  lesson_id text references lessons(id) on delete cascade,
  derived_content jsonb,
  derived_at timestamptz,
  constraint progressions_scope_unique unique nulls not distinct (student_id, course_id, lesson_id)
);

create index progressions_student_idx on progressions(student_id);
