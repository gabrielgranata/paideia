import Link from "next/link";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { signInAs } from "@/app/actions/auth";
import { getCurrentUser, type Role } from "@/lib/auth";
import { sql } from "@/lib/db";

// Hackathon profile picker. Reads users from DB; descriptions per user_id are
// hardcoded here because the demo register is small and the wording is
// authored, not generated.

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

const DESCRIPTIONS: Record<string, { subtitle: string; desc: string }> = {
  user_mr_k: {
    subtitle: "AP World History · Industrial Revolution",
    desc: "Author lessons, read student sessions, annotate progressions. The composer is at /teacher/lessons.",
  },
  user_maya: {
    subtitle: "AP World History · Lesson 3",
    desc: "Open your artifact home, work through your project on the working class, see your progression. The substrate is yours.",
  },
};

export default async function LoginPage() {
  const current = await getCurrentUser();

  const users = (await sql`
    select id, email, name, role
    from users
    order by role asc, name asc
  `) as unknown as UserRow[];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: tokens.color.canvas,
      }}
    >
      <Chrome title="Sign in" subtitle="Hackathon demo" />

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 720 }}>
          <p
            style={{
              fontSize: 13,
              color: tokens.color.sec,
              fontFamily: tokens.font.body,
              fontStyle: "italic",
              textAlign: "center",
              margin: "0 0 22px",
            }}
          >
            {current
              ? `Currently signed in as ${current.name}. Pick a profile to continue or switch.`
              : "No password. Pick a profile to continue."}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(users.length, 2)}, minmax(0, 1fr))`,
              gap: 14,
            }}
          >
            {users.map((u) => {
              const isCurrent = current?.id === u.id;
              const meta = DESCRIPTIONS[u.id] ?? {
                subtitle: u.email,
                desc: "",
              };
              return (
                <form action={signInAs} key={u.id}>
                  <input type="hidden" name="user_id" value={u.id} />
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      background: tokens.color.cardLight,
                      border: `1px solid ${
                        isCurrent ? tokens.color.text : tokens.color.border
                      }`,
                      borderRadius: 5,
                      padding: "24px 28px",
                      fontFamily: tokens.font.body,
                      color: tokens.color.text,
                      boxShadow: tokens.shadow,
                      display: "flex",
                      flexDirection: "column",
                      gap: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: tokens.color.ter,
                          textTransform: "uppercase",
                          letterSpacing: "0.10em",
                          fontFamily: tokens.font.ui,
                        }}
                      >
                        {u.role === "teacher" ? "Teacher" : "Student"}
                      </span>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: tokens.color.faint,
                            textTransform: "uppercase",
                            letterSpacing: "0.10em",
                            fontFamily: tokens.font.ui,
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 24,
                        fontFamily: tokens.font.display,
                        fontStyle: "italic",
                        color: tokens.color.text,
                        marginBottom: 6,
                        lineHeight: 1.3,
                      }}
                    >
                      {u.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: tokens.color.ter,
                        marginBottom: 14,
                        fontFamily: tokens.font.body,
                      }}
                    >
                      {meta.subtitle}
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: tokens.color.sec,
                        lineHeight: 1.6,
                        fontFamily: tokens.font.body,
                        fontStyle: "italic",
                        margin: "0 0 8px",
                      }}
                    >
                      {meta.desc}
                    </p>
                    <span
                      style={{
                        fontSize: 10,
                        color: tokens.color.faint,
                        fontFamily: tokens.font.ui,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {u.email}
                    </span>
                  </button>
                </form>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 20,
              padding: "16px 20px",
              border: `1px dashed ${tokens.color.border}`,
              borderRadius: 4,
              background: tokens.color.canvas,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: 9,
                  fontWeight: 700,
                  color: tokens.color.ter,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                New here?
              </div>
              <div
                style={{
                  fontFamily: tokens.font.body,
                  fontSize: 13,
                  color: tokens.color.sec,
                  fontStyle: "italic",
                }}
              >
                Create a new student account and pick a course to enroll in.
              </div>
            </div>
            <Link
              href="/signup"
              style={{
                padding: "8px 16px",
                background: tokens.ai.label,
                color: tokens.ai.bg,
                fontFamily: tokens.font.ui,
                fontSize: 10,
                fontWeight: 700,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Create student →
            </Link>
          </div>

          <p
            style={{
              fontSize: 10,
              color: tokens.color.faint,
              fontFamily: tokens.font.body,
              fontStyle: "italic",
              textAlign: "center",
              margin: "28px 0 0",
            }}
          >
            Cookie only. No password. Replace before anyone outside the demo touches it.
          </p>
        </div>
      </div>
    </div>
  );
}
