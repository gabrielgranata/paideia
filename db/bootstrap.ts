// Bootstrap: drops + recreates schema, then seeds the minimum fixtures —
// one teacher, one student, their auth users. Nothing else. The teacher
// creates the course and lessons live; the student signs up or uses the
// seeded student profile.
//
// Run with: npm run db:reset
//
// Seed-only-auth policy: lessons/sessions/readings/artifacts/teacher_chats
// all start empty. Pre-seeded substrate or pre-seeded lesson content
// (with the now-structured ai_generated / reading / video shapes) is too
// easy to wedge in the wrong shape and confuse the planner. Let the
// teacher seed reality by clicking around.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "schema.sql");

const url = process.env.DATABASE_URL ?? "postgres://paideia:paideia@localhost:5433/paideia";
const sql = postgres(url);

async function main() {
  const schema = readFileSync(schemaPath, "utf8");

  console.log("Resetting schema…");
  await sql.unsafe(schema);

  console.log("Seeding minimal fixtures…");

  // Teacher row.
  await sql`insert into teachers (id, name) values ('teacher_k', 'Mr. Okafor')`;

  // Student row — empty profile. stage/summary/flagged stay null/false so
  // the dashboard renders an honest empty state until real work exists.
  await sql`
    insert into students (id, name, stage, summary, flagged)
    values ('student_maya', 'Maya Chen', null, null, false)
  `;

  // Auth users. /login reads these.
  await sql`
    insert into users (id, email, name, role, teacher_id, student_id)
    values ('user_mr_k', 'okafor@paideia.edu', 'Mr. Okafor', 'teacher', 'teacher_k', null)
  `;
  await sql`
    insert into users (id, email, name, role, teacher_id, student_id)
    values ('user_maya', 'maya@paideia.edu', 'Maya Chen', 'student', null, 'student_maya')
  `;

  const counts = await sql`
    select
      (select count(*)::int from teachers)                 as teachers,
      (select count(*)::int from students)                 as students,
      (select count(*)::int from users)                    as users,
      (select count(*)::int from courses)                  as courses,
      (select count(*)::int from course_enrollments)       as enrollments,
      (select count(*)::int from lessons)                  as lessons,
      (select count(*)::int from sessions)                 as sessions,
      (select count(*)::int from nodes)                    as nodes,
      (select count(*)::int from edges)                    as edges,
      (select count(*)::int from turns)                    as turns,
      (select count(*)::int from readings)                 as readings,
      (select count(*)::int from artifacts)                as artifacts,
      (select count(*)::int from progression_annotations)  as annotations,
      (select count(*)::int from teacher_chats)            as teacher_chats,
      (select count(*)::int from backboard_scopes)         as backboard_scopes
  `;
  console.log("Seeded counts:", counts[0]);

  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
