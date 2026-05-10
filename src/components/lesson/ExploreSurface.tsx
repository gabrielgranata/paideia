"use client";

// ExploreSurface — the student's writing area. Three modes (Notes /
// Draft / Reflection) share one surface; each mode persists its own text.
// Two save semantics:
//
//   1. Debounced autosave (~2.5s of idle) — patches sessions.working_text
//      via saveWorkingText. No AI call. Pure persistence so a reload or
//      tab switch never loses work.
//   2. Save & reflect — an explicit submit that runs the bounded turn-call
//      (substrate delta + next_gap). The annotation appears in the right
//      rail; the writing stays put.
//
// State model: we hold all three modes in client state so switching tabs
// is instant. Autosave only fires for the active mode (the others haven't
// changed since the last sync). On mode switch we flush any pending save
// for the previous mode.

import { useEffect, useRef, useState, useTransition } from "react";
import { tokens } from "@/lib/design/tokens";
import { saveWorkingText, submitTurn } from "@/app/actions/turn";
import { composeArtifact } from "@/app/actions/student";

type Mode = "notes" | "draft" | "reflection";
type ArtifactIntent = "study_guide" | "presentation" | "test_prep";

const ARTIFACT_INTENTS: ReadonlyArray<{
  key: ArtifactIntent;
  label: string;
  blurb: string;
}> = [
  {
    key: "study_guide",
    label: "Study guide",
    blurb: "What you've worked through · what's still in play.",
  },
  {
    key: "test_prep",
    label: "Test prep",
    blurb: "Topic by topic. Open questions stay open.",
  },
  {
    key: "presentation",
    label: "Presentation",
    blurb: "Slide outline; you fill in the delivery.",
  },
];

const MODES: ReadonlyArray<{ key: Mode; label: string; placeholder: string }> = [
  {
    key: "notes",
    label: "Notes",
    placeholder:
      "Write in your own voice. First reactions, half-formed ideas, things you noticed in the materials. The work happens here.",
  },
  {
    key: "draft",
    label: "Draft",
    placeholder:
      "Build the formal version. Paragraph by paragraph. Bring the strongest of your notes into the argument.",
  },
  {
    key: "reflection",
    label: "Reflection",
    placeholder:
      "What did you change your mind about? What's still unresolved? Where did the strongest objection actually land?",
  },
];

const AUTOSAVE_DELAY_MS = 2500;

type Props = {
  sessionId: string;
  lessonId: string;
  lessonTitle: string;
  hasSubstrate: boolean;
  initialNotes: string;
  initialDraft: string;
  initialReflection: string;
};

export default function ExploreSurface({
  sessionId,
  lessonId,
  lessonTitle,
  hasSubstrate,
  initialNotes,
  initialDraft,
  initialReflection,
}: Props) {
  const [mode, setMode] = useState<Mode>("notes");
  const [texts, setTexts] = useState<Record<Mode, string>>({
    notes: initialNotes,
    draft: initialDraft,
    reflection: initialReflection,
  });
  const [savedTexts, setSavedTexts] = useState<Record<Mode, string>>({
    notes: initialNotes,
    draft: initialDraft,
    reflection: initialReflection,
  });
  const [isSaving, startSave] = useTransition();
  const [isReflecting, startReflect] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush a save for a given mode/text pair if dirty. Used by autosave
  // and by mode-switch flush.
  function flush(modeToFlush: Mode, textToFlush: string) {
    if (savedTexts[modeToFlush] === textToFlush) return;
    const fd = new FormData();
    fd.set("session_id", sessionId);
    fd.set("mode", modeToFlush);
    fd.set("text", textToFlush);
    startSave(async () => {
      await saveWorkingText(fd);
      setSavedTexts((s) => ({ ...s, [modeToFlush]: textToFlush }));
    });
  }

  // Debounced autosave: whenever the active mode's text changes, schedule
  // a save 2.5s later. New keystrokes reset the timer.
  useEffect(() => {
    const current = texts[mode];
    if (savedTexts[mode] === current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush(mode, current);
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // We want this to run on text/mode change, not on savedTexts change
    // (which would re-arm the timer after every successful save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts, mode]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    // Flush whatever is pending for the current mode before switching.
    if (timerRef.current) clearTimeout(timerRef.current);
    flush(mode, texts[mode]);
    setMode(next);
  }

  function handleReflect() {
    // Make sure the latest text is on disk before the turn-call reads it.
    if (timerRef.current) clearTimeout(timerRef.current);
    const current = texts[mode];
    const fd = new FormData();
    fd.set("session_id", sessionId);
    fd.set("mode", mode);
    startReflect(async () => {
      // Save synchronously first so submitTurn reads the latest text.
      if (savedTexts[mode] !== current) {
        const saveFd = new FormData();
        saveFd.set("session_id", sessionId);
        saveFd.set("mode", mode);
        saveFd.set("text", current);
        await saveWorkingText(saveFd);
        setSavedTexts((s) => ({ ...s, [mode]: current }));
      }
      await submitTurn(fd);
    });
  }

  const currentText = texts[mode];
  const currentSaved = savedTexts[mode];
  const dirty = currentText !== currentSaved;
  const currentMode = MODES.find((m) => m.key === mode)!;

  return (
    <section
      aria-label="Your writing"
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* Mode tabs */}
      <div
        role="tablist"
        aria-label="Writing mode"
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 14,
          borderBottom: `1px solid ${tokens.color.border}`,
        }}
      >
        {MODES.map((m) => {
          const active = mode === m.key;
          const filled = texts[m.key].trim().length > 0;
          return (
            <button
              key={m.key}
              role="tab"
              aria-selected={active}
              onClick={() => switchMode(m.key)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "8px 14px 9px",
                fontFamily: tokens.font.ui,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: active ? tokens.color.text : tokens.color.ter,
                borderBottom: `2px solid ${
                  active ? tokens.color.text : "transparent"
                }`,
                marginBottom: -1,
                opacity: filled || active ? 1 : 0.7,
              }}
            >
              {m.label}
              {filled && !active && (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: tokens.color.ter,
                    marginLeft: 7,
                    verticalAlign: "middle",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Writing surface — large, EB Garamond, foreground. */}
      <textarea
        value={currentText}
        onChange={(e) =>
          setTexts((s) => ({ ...s, [mode]: e.target.value }))
        }
        placeholder={currentMode.placeholder}
        spellCheck
        style={{
          flex: 1,
          minHeight: 280,
          width: "100%",
          padding: "16px 4px",
          border: "none",
          outline: "none",
          background: "transparent",
          resize: "none",
          fontFamily: tokens.font.body,
          fontSize: 17,
          lineHeight: 1.8,
          color: tokens.color.text,
        }}
      />

      {/* Save controls */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px solid ${tokens.color.border}`,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: tokens.color.ter,
          }}
        >
          {isSaving
            ? "Saving…"
            : dirty
              ? "Unsaved changes"
              : "Saved"}
        </span>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={handleReflect}
            disabled={isReflecting || currentText.trim().length === 0}
            style={{
              padding: "9px 18px",
              background:
                isReflecting || currentText.trim().length === 0
                  ? tokens.color.margin
                  : tokens.ai.label,
              color:
                isReflecting || currentText.trim().length === 0
                  ? tokens.color.ter
                  : tokens.ai.bg,
              border: "none",
              borderRadius: 3,
              fontFamily: tokens.font.ui,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor:
                isReflecting || currentText.trim().length === 0
                  ? "default"
                  : "pointer",
            }}
          >
            {isReflecting ? "Reading…" : "Save & reflect →"}
          </button>
        </div>
      </footer>

      <ComposePanel
        lessonId={lessonId}
        lessonTitle={lessonTitle}
        hasSubstrate={hasSubstrate}
      />
    </section>
  );
}

// ComposePanel — compact "make an artifact from this lesson" affordance,
// pinned to the foot of the writing surface. Intent + title; lesson is
// the current session's lesson. Submits to the existing composeArtifact
// server action, which redirects to /artifacts/[id] on success. Disabled
// when the substrate is empty — there's nothing to compose from until the
// student has hit Save & Reflect at least once.
function ComposePanel({
  lessonId,
  lessonTitle,
  hasSubstrate,
}: {
  lessonId: string;
  lessonTitle: string;
  hasSubstrate: boolean;
}) {
  const [intent, setIntent] = useState<ArtifactIntent>("study_guide");
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const [isComposing, startCompose] = useTransition();

  const intentDef = ARTIFACT_INTENTS.find((i) => i.key === intent)!;
  const titleTrim = title.trim();
  const canCompose = hasSubstrate && titleTrim.length > 0 && !isComposing;

  function handleSubmit() {
    if (!canCompose) return;
    const fd = new FormData();
    fd.set("intent", intent);
    fd.set("title", titleTrim);
    fd.append("lesson_id", lessonId);
    startCompose(async () => {
      // composeArtifact will redirect on completion. Errors from the
      // server action surface as a thrown promise — let it bubble.
      await composeArtifact(fd);
    });
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      style={{
        marginTop: 22,
        paddingTop: 14,
        borderTop: `1px solid ${tokens.color.border}`,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            color: tokens.ai.label,
          }}
        >
          {tokens.aiMarker} Compose an artifact from this lesson
        </span>
        <span
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12,
            fontStyle: "italic",
            color: tokens.color.ter,
          }}
        >
          {open ? "Hide" : hasSubstrate ? "Open" : "Locked until you save & reflect"}
        </span>
      </summary>

      <div
        style={{
          marginTop: 14,
          padding: "16px 18px",
          background: tokens.color.cardLight,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: 4,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {!hasSubstrate && (
          <p
            style={{
              margin: 0,
              fontFamily: tokens.font.body,
              fontSize: 12.5,
              fontStyle: "italic",
              color: tokens.color.ter,
              lineHeight: 1.6,
            }}
          >
            Save &amp; reflect on your writing first so the composer has
            something to organize. There&apos;s nothing in the substrate yet
            for {lessonTitle}.
          </p>
        )}

        {/* Intent pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ARTIFACT_INTENTS.map((i) => {
            const active = intent === i.key;
            return (
              <button
                key={i.key}
                type="button"
                onClick={() => setIntent(i.key)}
                disabled={!hasSubstrate}
                style={{
                  padding: "7px 14px",
                  border: `1px solid ${active ? tokens.ai.label : tokens.color.border}`,
                  background: active ? tokens.ai.label : "transparent",
                  color: active ? tokens.ai.bg : tokens.color.text,
                  borderRadius: 3,
                  fontFamily: tokens.font.ui,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: hasSubstrate ? "pointer" : "default",
                  opacity: hasSubstrate ? 1 : 0.5,
                }}
              >
                {i.label}
              </button>
            );
          })}
        </div>

        <p
          style={{
            margin: 0,
            fontFamily: tokens.font.body,
            fontSize: 12,
            fontStyle: "italic",
            color: tokens.color.sec,
            lineHeight: 1.6,
          }}
        >
          {intentDef.blurb}
        </p>

        {/* Title */}
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: tokens.color.ter,
            }}
          >
            Title
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!hasSubstrate}
            placeholder={`e.g. "${lessonTitle} — review"`}
            style={{
              padding: "9px 12px",
              fontFamily: tokens.font.body,
              fontSize: 14,
              color: tokens.color.text,
              background: tokens.color.canvas,
              border: `1px solid ${tokens.color.border}`,
              borderRadius: 3,
              outline: "none",
            }}
          />
        </label>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingTop: 4,
          }}
        >
          <p
            style={{
              margin: 0,
              flex: 1,
              fontFamily: tokens.font.body,
              fontSize: 11.5,
              fontStyle: "italic",
              color: tokens.color.ter,
              lineHeight: 1.5,
            }}
          >
            Draws from your reasoning in this lesson · ~6–10 seconds to compose.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canCompose}
            style={{
              padding: "9px 18px",
              background: canCompose ? tokens.ai.label : tokens.color.margin,
              color: canCompose ? tokens.ai.bg : tokens.color.ter,
              border: "none",
              borderRadius: 3,
              fontFamily: tokens.font.ui,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: canCompose ? "pointer" : "default",
              whiteSpace: "nowrap",
            }}
          >
            {isComposing ? "Composing…" : "Compose →"}
          </button>
        </div>
      </div>
    </details>
  );
}
