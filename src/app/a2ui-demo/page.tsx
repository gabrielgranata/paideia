import Renderer from "@/components/a2ui/Renderer";
import Chrome from "@/components/a2ui/Chrome";
import { tokens } from "@/lib/design/tokens";
import {
  lessonViewSpec,
  artifactGridSpec,
  teacherReadingViewSpec,
} from "@/lib/a2ui/example-specs";

export const metadata = {
  title: "A2UI catalog — demo",
};

export default function A2UIDemoPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: tokens.color.canvas,
        color: tokens.color.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Chrome title="A2UI Demo" subtitle="Catalog · Direction E" />
      <div
        style={{
          flex: 1,
          padding: "48px 36px 96px",
          display: "flex",
          flexDirection: "column",
          gap: 72,
        }}
      >
        <Section
          eyebrow="Lesson View"
          description="Maya's Versailles argument, composed from the substrate. Each cited sentence carries a superscript with the citing node count; meta-prose (cites: []) renders italic at low opacity. The QuestionPrompt below stands by typography alone — no panel, no accent — and surfaces the political-legitimacy gap her current argument leaves implicit."
        >
          <Renderer spec={lessonViewSpec} />
        </Section>

        <Section
          eyebrow="Artifact Grid"
          description="Four ArtifactCards resolved by id from a single ArtifactGrid. Cream cards on cream canvas; the only color signal is the warm border. The grid is navigation, not generation — each card links through to a substrate-anchored artifact page."
        >
          <Renderer spec={artifactGridSpec} />
        </Section>

        <Section
          eyebrow="Teacher Reading"
          description="Four sectioned ComposedNarratives (resolved, in progress, unaddressed, recommended next), each section opened by a meta-prose heading. Sections are introduced by uncited prose because they are commentary on the substrate, not derivations from it."
        >
          <Renderer spec={teacherReadingViewSpec} />
        </Section>
      </div>
    </main>
  );
}

function Section({
  eyebrow,
  description,
  children,
}: {
  eyebrow: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        maxWidth: 768,
        margin: "0 auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: tokens.color.ter,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontFamily: tokens.font.ui,
          }}
        >
          {eyebrow}
        </div>
        <p
          style={{
            fontSize: 13,
            color: tokens.color.sec,
            fontFamily: tokens.font.body,
            fontStyle: "italic",
            lineHeight: 1.6,
            margin: 0,
            maxWidth: 640,
          }}
        >
          {description}
        </p>
        <div
          style={{
            height: 1,
            background: tokens.color.border,
            marginTop: 4,
          }}
        />
      </header>
      {children}
    </section>
  );
}
