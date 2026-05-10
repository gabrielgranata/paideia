import { type VideoContent } from "@/lib/lesson-blocks";
import { parseYouTubeId } from "@/lib/video/youtube";
import { tokens } from "@/lib/design/tokens";

// VideoPlayer — server component. Renders a teacher-supplied video as
// material in the main column, alongside readings. Not an AI surface; the
// student watches in silence and writes about what they saw in Think-out-
// loud. No transcript-AI pipe, no chapter markers, no "ask about this
// clip" affordance — that would be a completion-affordance drift.
//
// Provider dispatch:
//   - youtube → privacy-enhanced iframe (nocookie domain), rel=0 to
//     suppress the end-of-video related-video grid that pulls attention
//     off the writing task. Honors VideoContent.start_s; falls back to
//     the start param parsed out of the pasted URL.
//   - vimeo / mp4 → not wired in this iteration. Render a faint pill so
//     a stub block doesn't crash the page.
//
// Empty url is a stub state (the teacher added the block but hasn't
// pasted a link yet). Renders as a faint pill, never as an error.

type Props = {
  content: VideoContent;
  title?: string;
};

export default function VideoPlayer({ content, title }: Props) {
  if (content.url.trim().length === 0) {
    return <PlaceholderPill text="No video link yet" />;
  }

  if (content.provider === "youtube") {
    return <YouTubeFrame content={content} title={title} />;
  }

  return <PlaceholderPill text={`${content.provider} playback not wired`} />;
}

function YouTubeFrame({ content, title }: { content: VideoContent; title?: string }) {
  const parsed = parseYouTubeId(content.url);
  if (!parsed) {
    return <PlaceholderPill text="Couldn’t read that YouTube URL" />;
  }

  const start = content.start_s ?? parsed.startSeconds;
  const params = new URLSearchParams({ rel: "0" });
  if (start && start > 0) params.set("start", String(start));
  const src = `https://www.youtube-nocookie.com/embed/${parsed.id}?${params.toString()}`;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        paddingBottom: "56.25%",
        background: tokens.color.canvas,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <iframe
        src={src}
        title={title ?? "Video"}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: 0,
        }}
      />
    </div>
  );
}

function PlaceholderPill({ text }: { text: string }) {
  return (
    <div
      style={{
        background: tokens.color.canvas,
        border: `1px dashed ${tokens.color.border}`,
        borderRadius: 3,
        padding: "20px 16px",
        textAlign: "center",
        fontFamily: tokens.font.body,
        fontSize: 12,
        color: tokens.color.ter,
        fontStyle: "italic",
      }}
    >
      ▶ {text}
    </div>
  );
}
