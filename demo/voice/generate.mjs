// ElevenLabs TTS driver for demo/voice-script.md.
//
// Parses each "## PREFIX-N" block (e.g. "## PHIL-1", "## BUILD-7",
// "## CLOSE-4"), strips the heading, and generates one mp3 per clip
// under demo/voice/out/. Filenames mirror the clip id: PHIL-1.mp3, etc.
//
// Also still parses legacy "## SEGMENT N" / "## EXT-X" headings for
// backward compatibility with the original 6+6 cut.
//
// Required env:
//   ELEVENLABS_API_KEY   xi-api-key
//   ELEVENLABS_VOICE_ID  voice id (browse https://elevenlabs.io/app/voice-library)
//
// Optional env:
//   ELEVENLABS_MODEL_ID  default: eleven_multilingual_v2
//
// Usage:
//   node --env-file=.env demo/voice/generate.mjs                  # all segments
//   node --env-file=.env demo/voice/generate.mjs --only=1,4,EXT-B # subset
//   node demo/voice/generate.mjs --dry-run                        # parse only

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(HERE, "..", "voice-script.md");
const OUT_DIR = join(HERE, "out");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const onlyArg = [...args].find((a) => a.startsWith("--only="));
const only = onlyArg
  ? new Set(onlyArg.slice("--only=".length).split(",").map((s) => s.trim()))
  : null;

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

if (!dryRun && (!API_KEY || !VOICE_ID)) {
  console.error("missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID");
  process.exit(1);
}

// --- parse ---------------------------------------------------------------

// Match three heading shapes:
//   "## PHIL-1 — ..." / "## BUILD-7" / "## CLOSE-4"  (current narrative pass)
//   "## SEGMENT 1 — ..."                              (legacy)
//   "## EXT-A — ..."                                  (legacy)
// Capture the id token and everything until the next heading (any level).
// A sentinel heading is appended to the input so the final clip terminates —
// JS regex has no \Z.
const HEADING =
  /^##\s+(?:([A-Z]+-\d+)|SEGMENT\s+(\d+)|EXT-([A-Z]))\b[^\n]*\n([\s\S]*?)(?=^#)/gm;

function parseSegments(md) {
  const segments = [];
  const padded = md + "\n# __END__\n";
  for (const m of padded.matchAll(HEADING)) {
    const id = m[1] ? m[1] : m[2] ? m[2] : `EXT-${m[3]}`;
    const body = m[4]
      .replace(/^---\s*$/gm, "")   // strip horizontal rules
      .replace(/\n{3,}/g, "\n\n")  // collapse triple+ blank lines
      .trim();
    if (body) segments.push({ id, text: body });
  }
  return segments;
}

// --- tts -----------------------------------------------------------------

async function synthesize(text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// --- main ----------------------------------------------------------------

const md = readFileSync(SCRIPT_PATH, "utf8");
const segments = parseSegments(md);

if (segments.length === 0) {
  console.error("no segments parsed — check heading format in voice-script.md");
  process.exit(1);
}

const selected = only ? segments.filter((s) => only.has(s.id)) : segments;
if (only && selected.length !== only.size) {
  const found = new Set(selected.map((s) => s.id));
  const missing = [...only].filter((id) => !found.has(id));
  console.error(`unknown segment id(s): ${missing.join(", ")}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const seg of selected) {
  // Legacy SEGMENT ids are bare digits ("1") and need the prefix added back.
  // Everything else (PHIL-3, BUILD-7, EXT-A, ...) is its own filename stem.
  const filename = /^\d+$/.test(seg.id)
    ? `SEGMENT-${seg.id}.mp3`
    : `${seg.id}.mp3`;
  const outPath = join(OUT_DIR, filename);

  if (dryRun) {
    console.log(`--- ${seg.id} → ${filename} (${seg.text.length} chars) ---`);
    console.log(seg.text);
    console.log("");
    continue;
  }

  process.stdout.write(`[${seg.id}] ${seg.text.length} chars → ${filename} ... `);
  const audio = await synthesize(seg.text);
  writeFileSync(outPath, audio);
  console.log("ok");
}
