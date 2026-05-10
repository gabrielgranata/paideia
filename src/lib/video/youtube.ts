// Parse a teacher-pasted YouTube URL into the embed-relevant parts.
// Returns null for anything we can't confidently embed; callers fall back
// to a faint placeholder rather than rendering a broken iframe.
//
// Accepted shapes:
//   https://www.youtube.com/watch?v=ID
//   https://youtube.com/watch?v=ID&t=30s
//   https://youtu.be/ID
//   https://youtu.be/ID?t=30
//   https://www.youtube.com/embed/ID?start=30
//   https://www.youtube.com/shorts/ID
//
// We accept `?t=...` (watch/share style) and `?start=...` (embed style).
// `t` may be "30", "30s", "1m30s", or "1h2m3s".

export type ParsedYouTube = {
  id: string;
  startSeconds?: number;
};

const ID_RE = /^[A-Za-z0-9_-]{6,}$/;

function parseStartParam(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;

  // Pure integer seconds.
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  // h/m/s composite (e.g. "1h2m3s", "1m30s", "30s").
  const m = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (!m) return undefined;
  const [, h, mm, ss] = m;
  if (!h && !mm && !ss) return undefined;
  const total =
    (h ? Number(h) * 3600 : 0) +
    (mm ? Number(mm) * 60 : 0) +
    (ss ? Number(ss) : 0);
  return total > 0 ? total : undefined;
}

export function parseYouTubeId(input: string): ParsedYouTube | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (raw.length === 0) return null;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") {
      id = url.searchParams.get("v");
    } else if (parts[0] === "embed" || parts[0] === "shorts") {
      id = parts[1] ?? null;
    }
  }

  if (!id || !ID_RE.test(id)) return null;

  const startSeconds =
    parseStartParam(url.searchParams.get("t")) ??
    parseStartParam(url.searchParams.get("start"));

  return startSeconds !== undefined ? { id, startSeconds } : { id };
}
