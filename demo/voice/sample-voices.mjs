// Generate voice-comparison samples across multiple ElevenLabs voices.
// Three sample clips (rewritten in the conversational register, not the
// existing voice-script.md prose) per voice. Output:
//
//   demo/voice/samples/<voice-label>/<clip-id>.mp3
//
// Usage: node --env-file=.env demo/voice/sample-voices.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = join(HERE, "samples");

const API_KEY = process.env.ELEVENLABS_API_KEY;
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

if (!API_KEY) {
  console.error("missing ELEVENLABS_API_KEY");
  process.exit(1);
}

const VOICES = [
  { label: "lily",    id: "pFZP5JQG7iQjIQuC4Bku" },  // current
  { label: "damiaan", id: "L3NacDtfFuYL0m0wJjjq" },  // user pick
  { label: "adam",    id: "pNInz6obpgDQGcFmaJgB" },
  { label: "brian",   id: "nPczCjzI2devNBz1zQrb" },
  { label: "rachel",  id: "21m00Tcm4TlvDq8ikWAM" },
];

// Three sample clips written in the rewritten conversational register —
// not the current voice-script.md prose. These showcase voice character
// against clean, varied-rhythm text that won't blame the voice for the
// script's failings.

const CLIPS = [
  {
    id: "PHIL-3",
    text: `Here's the thing about reasoning. You don't really have it sitting somewhere, waiting to be used. You have it while you're doing it. The work is the activity, not something the activity produces.

So when a chatbot hands a student a finished argument, the student doesn't take possession of that reasoning. They didn't do it. They got it. The difference shows up later, when the student has to think without the AI in the room.

That's what Paideia is built around. The system shows the student something to think about. The thinking stays with them.`,
  },
  {
    id: "READ-1",
    text: `Mr. Okafor's back at his desk. He opens Maya's project.

No grade. No rubric. What loads is a four-part read of where Maya's reasoning is right now. What she's worked through. Where she's standing. What she hasn't gotten to. And the question that would push her forward.

Each part comes from Maya's actual work — the notes she's written, the dated draft passages, the questions the AI surfaced and how she responded. Mr. Okafor reads it and starts to decide what to say to her tomorrow.`,
  },
  {
    id: "CLOSE-4",
    text: `Paideia doesn't tutor the student. It doesn't try to model what they know. It just makes their reasoning visible — to themselves, and to a teacher who couldn't otherwise see it. And it does that without doing the reasoning for them.

That's the missing piece.`,
  },
];

async function synthesize(voiceId, text) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
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

mkdirSync(SAMPLES_DIR, { recursive: true });

for (const voice of VOICES) {
  const dir = join(SAMPLES_DIR, voice.label);
  mkdirSync(dir, { recursive: true });
  for (const clip of CLIPS) {
    const outPath = join(dir, `${clip.id}.mp3`);
    process.stdout.write(`[${voice.label} / ${clip.id}] ${clip.text.length} chars → ${voice.label}/${clip.id}.mp3 ... `);
    try {
      const audio = await synthesize(voice.id, clip.text);
      writeFileSync(outPath, audio);
      console.log("ok");
    } catch (err) {
      console.log(`FAIL — ${err.message}`);
    }
  }
}
