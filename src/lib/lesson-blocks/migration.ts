// Migration helpers — upgrade legacy block.content shapes to the new
// typed shapes. Idempotent: re-running on already-migrated data is a no-op.
//
// Use cases:
//  - db/bootstrap.ts: when reseeding, fixtures may be written in the legacy
//    shape (string content for reading/video). Run migrateBlocks() on the
//    seed blocks before insert.
//  - At read time as a safety net: parseBlock() will fail on legacy shapes,
//    so the planner page upgrades blocks defensively via maybeMigrateBlocks
//    if the validator throws.
//
// The migration never invents data. A legacy string `reading.content` of
// "An excerpt from Mona Ozouf" becomes a single human-authored segment
// with that exact text. A legacy string `video.content` of a URL becomes
// `{ url, provider: guessProvider(url) }`. No interpretation, no enrichment.

import { randomUUID } from "node:crypto";
import {
  type Block,
  type TypedBlock,
  type VideoContent,
  type Doc,
  type AIGeneratedContent,
  parseBlock,
} from "./schemas";

function segId(): string {
  return `seg_${randomUUID().slice(0, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function guessProvider(url: string): "youtube" | "vimeo" | "mp4" {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  return "mp4";
}

function migrateReadingContent(content: unknown): Doc {
  // Already a Doc?
  if (
    content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    Array.isArray((content as { segments?: unknown }).segments)
  ) {
    return content as Doc;
  }
  // Legacy string content.
  const text = typeof content === "string" ? content : "";
  return {
    segments: text
      ? [{ id: segId(), kind: "human", body: text }]
      : [],
  };
}

function migrateAIGeneratedContent(content: unknown): AIGeneratedContent {
  // Already in the new shape?
  if (
    content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    "segment" in content
  ) {
    return content as AIGeneratedContent;
  }
  // Legacy string content. Empty → null (no segment yet). Non-empty →
  // wrap as an AI paragraph segment with a placeholder generation stamp
  // marking it as a legacy import (so audit consumers can tell it didn't
  // come through the composer).
  const text = typeof content === "string" ? content : "";
  if (text.trim().length === 0) {
    return { segment: null };
  }
  return {
    segment: {
      id: segId(),
      kind: "ai",
      sub_kind: "paragraph",
      body: text,
      generation: {
        prompt: "[legacy import — pre-segment ai_generated content]",
        model: "legacy",
        generated_at: nowIso(),
      },
    },
  };
}

function migrateVideoContent(content: unknown): VideoContent {
  // Already structured?
  if (
    content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    typeof (content as { url?: unknown }).url === "string"
  ) {
    return content as VideoContent;
  }
  const url = typeof content === "string" ? content : "";
  return {
    url,
    provider: guessProvider(url),
  };
}

/**
 * Upgrade one block's content shape if needed. Pure function — does not
 * write to the database. Caller persists the result.
 */
export function migrateBlock(block: Block): TypedBlock {
  switch (block.type) {
    case "reading":
      return {
        id: block.id,
        type: "reading",
        content: migrateReadingContent(block.content),
        meta: block.meta,
        source: block.source,
      };
    case "video":
      return {
        id: block.id,
        type: "video",
        content: migrateVideoContent(block.content),
        meta: block.meta,
        source: block.source,
      };
    case "ai_generated":
      return {
        id: block.id,
        type: "ai_generated",
        content: migrateAIGeneratedContent(block.content),
        meta: block.meta,
        source: block.source,
      };
    default:
      return {
        id: block.id,
        type: block.type,
        content: typeof block.content === "string" ? block.content : "",
        meta: block.meta,
        source: block.source,
      };
  }
}

export function migrateBlocks(blocks: Block[]): TypedBlock[] {
  return blocks.map((b) => migrateBlock(b));
}

/**
 * Defensive read-time migration. If the strict parse fails, upgrade the
 * shape and try again. If it still fails, propagate the error — we'd
 * rather break loudly than silently render a half-broken planner.
 */
export function parseOrMigrateBlock(raw: unknown): TypedBlock {
  try {
    return parseBlock(raw);
  } catch {
    if (raw && typeof raw === "object" && "type" in raw) {
      return parseBlock(migrateBlock(raw as Block));
    }
    throw new Error("parseOrMigrateBlock: input is not a block");
  }
}

export function parseOrMigrateBlocks(raw: unknown): TypedBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((b) => parseOrMigrateBlock(b));
}
