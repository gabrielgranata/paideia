// Paideia design tokens.
//
// Direction E (Wide Margin) base — warm parchment canvas, EB Garamond
// typography, AI in the left margin. With the design-system pass, we add:
//
//   - panel / panelWarm — lifted card surfaces (white / warm off-white)
//   - textDisabled       — placeholder + dim states
//   - stage              — emerging / developing / connecting badges
//                          (soft violet / forest green / warm amber)
//   - ai                 — olive accent for the system's voice
//   - good               — positive observation block
//   - flag (re-shaped)   — the "missing warrant / gap" surface
//
// Discipline: position is still the primary signal (AI lives in the left
// margin; the student's column has no marker). Color is *secondary* — it
// confirms the spatial logic, it doesn't replace it.

export const tokens = {
  color: {
    // ── surfaces ────────────────────────────────────────────────────────
    canvas:       "#F4F0E8", // page background — warm parchment
    chrome:       "#F4F0E8", // top bar — same cream, no contrast
    card:         "#F4F0E8", // student writing surface (continuous with canvas)
    cardLight:    "#FFFDF8", // lifted card on cream (teacher composer blocks,
                             // catalog cards)
    panel:        "#FFFFFF", // pure-white lift (used sparingly — student
                             // detail surface, lesson-session writing area)
    panelWarm:    "#FAF7F2", // warm off-white card (floating doc feel)
    margin:       "#EBE6D8", // AI margin tone — slightly darker than canvas
    border:       "#CFC8B4",

    // ── text ────────────────────────────────────────────────────────────
    text:         "#1A1610", // primary — near-black warm
    sec:          "#5A5040", // secondary — warm gray-brown
    ter:          "#7A7060", // tertiary — labels, timestamps
    faint:        "#9A9080", // faint — Syne micro-labels, swatch values
    textDisabled: "#B0A898", // placeholder / disabled

    // ── flag / gap ──────────────────────────────────────────────────────
    flagBg:       "#F4EEE0",
    flagBd:       "#C0A060",
    flagText:     "#5A3808",
    flagLabel:    "#7A4410",
  },

  // ── AI — olive ────────────────────────────────────────────────────────
  // The system's voice. Used on observation blocks, prompt-to-student
  // affordances, the class-summary bar, and any "◆"-prefixed label that
  // needs more weight than a plain Syne micro-label.
  ai: {
    bg:     "#EBE6D8",
    border: "#C0B898",
    text:   "#4A4030",
    label:  "#3A3020",
    faint:  "#F4F0E8",
  } as const,

  // ── positive observation ──────────────────────────────────────────────
  // For ObsGood blocks on a student detail surface. Used sparingly —
  // observation cards are restrained, not celebratory.
  good: {
    bg:     "#F0FAF2",
    border: "#A8D8A8",
    text:   "#1A5C2A",
  } as const,

  // ── stage badges ──────────────────────────────────────────────────────
  // Soft, single-pill chips that read at a glance on a class dashboard.
  // emerging / developing / connecting are the three values; the schema
  // matches (students.stage check constraint).
  stage: {
    emerging:   { bg: "#EDE9FC", text: "#4A3AA0" },
    developing: { bg: "#E0F4E8", text: "#1A6040" },
    connecting: { bg: "#FFF0D0", text: "#7A4810" },
  } as const,

  shadow: "0 1px 6px rgba(0,0,0,0.06)",
  shadowMd: "0 2px 12px rgba(0,0,0,0.10)",

  font: {
    display: '"DM Serif Display", "EB Garamond", Georgia, serif',
    body:    '"EB Garamond", Georgia, serif',
    ui:      '"Syne", system-ui, sans-serif',
    mono:    '"DM Mono", "Courier New", monospace',
  },

  // The "◆" prefix is the universal AI marker — never use it on student-
  // authored surfaces. Pair it with italic body type and a Syne uppercase
  // mini-label: "◆ Context", "◆ Question", "◆ Observations".
  aiMarker: "◆",
} as const;

export type Tokens = typeof tokens;
export type Stage = keyof typeof tokens.stage;
