import Link from "next/link";
import { tokens } from "@/lib/design/tokens";
import Chrome from "@/components/a2ui/Chrome";
import { signUpAsStudent } from "@/app/actions/auth";

// Sign-up surface — student-only, hackathon-only. Name + email; no password.
// On success, redirects to /courses to choose what to enroll in.

export default function SignupPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        background: tokens.color.canvas,
      }}
    >
      <Chrome title="Create a new student" subtitle="Hackathon demo" />

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480 }}>
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
            Pick a name and an email. No password — this is a demo.
          </p>

          <form
            action={signUpAsStudent}
            style={{
              background: tokens.color.cardLight,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: 5,
              padding: "28px 32px",
              boxShadow: tokens.shadow,
            }}
          >
            <Field label="Name" name="name" placeholder="e.g. Maya Chen" required />
            <Field
              label="Email"
              name="email"
              placeholder="you@school.edu"
              type="email"
              required
            />
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "10px 0",
                background: tokens.ai.label,
                color: tokens.ai.bg,
                fontFamily: tokens.font.ui,
                fontSize: 11,
                fontWeight: 700,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginTop: 6,
              }}
            >
              Continue →
            </button>
          </form>

          <p
            style={{
              fontSize: 12,
              color: tokens.color.ter,
              fontFamily: tokens.font.body,
              fontStyle: "italic",
              textAlign: "center",
              margin: "20px 0 0",
            }}
          >
            Already have a profile?{" "}
            <Link
              href="/login"
              style={{
                color: tokens.color.text,
                textDecoration: "underline",
              }}
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  type,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span
        style={{
          display: "block",
          fontFamily: tokens.font.ui,
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.ter,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      <input
        name={name}
        type={type ?? "text"}
        placeholder={placeholder}
        required={required}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontFamily: tokens.font.body,
          fontSize: 15,
          color: tokens.color.text,
          background: tokens.color.canvas,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: 4,
          outline: "none",
        }}
      />
    </label>
  );
}
