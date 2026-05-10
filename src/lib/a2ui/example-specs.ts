import type { A2UISpec } from "./spec";

/**
 * Three hardcoded specs the demo page exercises. Content is substantive,
 * not placeholder — these are the verification surface for the catalog.
 *
 * Node IDs reference the seeded substrate from db/bootstrap.ts:
 *   n1 — assertion: "The Treaty of Versailles was a primary cause of WWII."
 *   n2 — support (superseded): the bare reparations-destroyed-Weimar story
 *   n3 — support: economic collapse → political extremism opening
 *   n4 — challenge: Weimar was recovering 1924–29; depression broke it
 *   n5 — assertion (qualified): Versailles vulnerability + depression trigger
 *   n6 — support: reparations limited Weimar's fiscal capacity in the depression
 *
 * The arc the lesson-view spec narrates: causal claim (n1) → mechanism
 * (n2) → counterexample (n4) → qualified mechanism (n5) supported by
 * vulnerability (n6). The political channel (n3) is acknowledged but
 * flagged as the unsurfaced gap the QuestionPrompt asks about.
 */

// ---------- 1. Lesson view ----------

export const lessonViewSpec: A2UISpec = {
  components: [
    {
      id: "narrative-1",
      type: "ComposedNarrative",
      props: {
        sentences: [
          {
            text: "Your argument so far:",
            cites: [],
          },
          {
            text: "You opened with the claim that the Treaty of Versailles was a primary cause of WWII.",
            cites: ["n1"],
          },
          {
            text: "You first reached for an economic mechanism — that reparations destroyed the Weimar economy and that the 1923 hyperinflation was the visible symptom of that pressure.",
            cites: ["n1", "n2"],
          },
          {
            text: "You acknowledged a counterexample: Weimar was actually recovering between 1924 and 1929, and it was the 1929 depression — not Versailles directly — that broke the political order.",
            cites: ["n4"],
          },
          {
            text: "You then revised: Versailles did not cause WWII on its own; it made Weimar more vulnerable, and the depression triggered the collapse, with both having to happen.",
            cites: ["n5"],
          },
          {
            text: "You support the revised mechanism by arguing that reparations and the loss of the Saar and Ruhr resources limited Weimar's fiscal capacity to absorb the depression shock — a government not already paying France and Belgium would have had room to spend instead of cutting wages like Brüning did.",
            cites: ["n5", "n6"],
          },
          {
            text: "Your argument currently treats the path from economic collapse to one specific political outcome as automatic.",
            cites: ["n3"],
          },
        ],
      },
    },
    {
      id: "question-1",
      type: "QuestionPrompt",
      props: {
        question:
          "If the depression had hit a Germany without Versailles, would the NSDAP still have become the largest party by July 1932? Your account explains the vulnerability but not yet the specific outcome.",
        target_node_ids: ["n3", "n5", "n6"],
        gap_type: "mechanism unstated",
      },
    },
  ],
  root_ids: ["narrative-1", "question-1"],
};

// ---------- 2. Artifact grid ----------

export const artifactGridSpec: A2UISpec = {
  components: [
    {
      id: "card-sg-1",
      type: "ArtifactCard",
      props: {
        artifact_id: "sg-versailles-econ",
        title: "Economic consequences of Versailles: a study guide",
        type: "Study guide",
        blurb:
          "Walks through reparations, the Dawes Plan, and the 1923 hyperinflation. Built from your inquiry nodes; extends none of them.",
      },
    },
    {
      id: "card-pres-1",
      type: "ArtifactCard",
      props: {
        artifact_id: "pres-weimar-collapse",
        title: "Weimar collapse: a presentation outline",
        type: "Presentation",
        blurb:
          "Slide-by-slide structure tracing your argument. Each slide cites the node it summarizes; gaps are marked, not filled.",
      },
    },
    {
      id: "card-handout-1",
      type: "ArtifactCard",
      props: {
        artifact_id: "handout-treaty-text",
        title: "Treaty primary-source excerpts",
        type: "Handout",
        blurb:
          "Articles 231 and 232 in original and translation, with the passages you have already cited highlighted.",
      },
    },
    {
      id: "card-rubric-1",
      type: "ArtifactCard",
      props: {
        artifact_id: "rubric-causal-argument",
        title: "Causal-argument rubric",
        type: "Rubric",
        blurb:
          "Criteria for evaluating a historical causal claim: warrant, counter-case, mechanism, scope. Used to surface the gap above.",
      },
    },
    {
      id: "grid-1",
      type: "ArtifactGrid",
      props: {
        card_ids: ["card-sg-1", "card-pres-1", "card-handout-1", "card-rubric-1"],
      },
    },
  ],
  root_ids: ["grid-1"],
};

// ---------- 3. Teacher reading view ----------
// Sections are introduced via meta-prose sentences (empty cites) inside
// a ComposedNarrative — using the spec's existing affordance rather than
// inventing a heading component.

export const teacherReadingViewSpec: A2UISpec = {
  components: [
    {
      id: "tr-resolved",
      type: "ComposedNarrative",
      props: {
        sentences: [
          { text: "Resolved:", cites: [] },
          {
            text: "Maya took the bare slogan that Versailles caused WWII and broke it into mechanism, opening with a strong economic story before pressure forced her to revise.",
            cites: ["n1", "n2"],
          },
          {
            text: "Pressed by the recovery counterexample — that Weimar was actually stabilizing between 1924 and 1929 — she gave up the bare reparations-destroyed-Weimar story cleanly rather than defending it past the point where it stopped working.",
            cites: ["n2", "n4"],
          },
        ],
      },
    },
    {
      id: "tr-in-progress",
      type: "ComposedNarrative",
      props: {
        sentences: [
          { text: "In progress:", cites: [] },
          {
            text: "Her current load-bearing claim is the qualified one: Versailles made Weimar more vulnerable, the depression triggered the collapse, both had to happen.",
            cites: ["n5"],
          },
          {
            text: "The vulnerability mechanism — that reparations and lost industrial resources constrained Weimar's fiscal capacity to absorb the depression shock — is doing real work and survives the counterexample that killed her first attempt.",
            cites: ["n5", "n6"],
          },
        ],
      },
    },
    {
      id: "tr-unaddressed",
      type: "ComposedNarrative",
      props: {
        sentences: [
          { text: "Unaddressed:", cites: [] },
          {
            text: "She has not engaged the political-legitimacy channel at all — the way Versailles gave the NSDAP a permanent rhetorical weapon independent of any economic mechanism.",
            cites: ["n3"],
          },
          {
            text: "If she only argues fiscal capacity, her account explains the vulnerability but not the specific outcome of one party reaching 107 seats in September 1930 rather than another.",
            cites: ["n3", "n6"],
          },
        ],
      },
    },
    {
      id: "tr-recommended",
      type: "ComposedNarrative",
      props: {
        sentences: [
          { text: "Recommended next:", cites: [] },
          {
            text: "Asking whether the NSDAP would still have become the largest party by July 1932 if the depression had hit a Germany without Versailles forces her to separate the economic mechanism from the political-legitimacy mechanism and decide whether her current position needs both.",
            cites: ["n3", "n5"],
          },
        ],
      },
    },
  ],
  root_ids: ["tr-resolved", "tr-in-progress", "tr-unaddressed", "tr-recommended"],
};
