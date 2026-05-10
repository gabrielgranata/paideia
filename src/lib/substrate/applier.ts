// Substrate applier — deterministic delta application.
//
// The LLM emits a TurnOutput (new nodes, new edges, optional gap, optional
// composed view). The applier translates that into Postgres writes:
//
//   - assigns real ids to new nodes; builds a tmp_id → real_id map
//   - resolves edge src/dst refs through that map (or treats as existing ids)
//   - inserts edges; on FK failure, logs and continues (one bad edge does
//     not kill the turn)
//   - returns the map so the caller can patch composed_view.cites and
//     next_gap.target_node_ids before persisting them on the turn row
//
// The LLM never writes the substrate. It emits proposals; this module
// applies them. The boundary is enforced here.

import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import type { TurnOutput } from "@/lib/llm/turn-call";

function newNodeId(): string {
  return `n_${randomUUID().slice(0, 10)}`;
}

function newEdgeId(): string {
  return `e_${randomUUID().slice(0, 10)}`;
}

export type ApplyResult = {
  tmp_to_real: Record<string, string>;
  inserted_node_ids: string[];
  inserted_edge_ids: string[];
};

export async function applyTurnDelta(
  sessionId: string,
  output: TurnOutput,
): Promise<ApplyResult> {
  const tmp_to_real: Record<string, string> = {};
  const inserted_node_ids: string[] = [];
  const inserted_edge_ids: string[] = [];

  for (const n of output.new_nodes) {
    const realId = newNodeId();
    tmp_to_real[n.tmp_id] = realId;
    inserted_node_ids.push(realId);
    await sql`
      insert into nodes (id, session_id, role, kind, content, status)
      values (${realId}, ${sessionId}, ${n.role}, ${n.kind}, ${n.content}, 'open')
    `;
  }

  for (const e of output.new_edges) {
    const src = tmp_to_real[e.src_ref] ?? e.src_ref;
    const dst = tmp_to_real[e.dst_ref] ?? e.dst_ref;
    const realId = newEdgeId();
    try {
      await sql`
        insert into edges (id, session_id, src_id, dst_id, relation, kind)
        values (${realId}, ${sessionId}, ${src}, ${dst}, ${e.relation}, ${e.kind})
      `;
      inserted_edge_ids.push(realId);
    } catch (err) {
      // FK violation or other write failure on a single edge. Don't kill the
      // whole turn — log and continue. The student's prose is preserved
      // upstream, the nodes are in, and the next turn can rebuild structure.
      console.error(
        `[applier] edge insert failed (src=${src} dst=${dst} relation=${e.relation}):`,
        err,
      );
    }
  }

  // When the student emits a refining assertion (positive edge of kind
  // "refines" / "qualifies" pointing from a new assertion to an existing
  // assertion), mark the older assertion as superseded. This keeps history
  // visible without making the dashboard or composer think the old position
  // is still live.
  for (const e of output.new_edges) {
    if (e.relation !== "positive") continue;
    const k = e.kind.toLowerCase();
    if (!k.includes("refin") && !k.includes("qualif") && !k.includes("supersed")) continue;
    const dst = tmp_to_real[e.dst_ref] ?? e.dst_ref;
    if (!dst || dst.startsWith("__")) continue;
    try {
      await sql`
        update nodes
        set status = 'superseded'
        where id = ${dst}
          and session_id = ${sessionId}
          and role = 'assertion'
          and status = 'open'
      `;
    } catch (err) {
      console.error(`[applier] supersede update failed for ${dst}:`, err);
    }
  }

  return { tmp_to_real, inserted_node_ids, inserted_edge_ids };
}

// Patch composed_view.cites and next_gap.target_node_ids by replacing
// tmp_ids with their real ids. Anything not in the map is passed through
// unchanged (treated as an existing id; if it doesn't exist the renderer
// will gracefully skip the citation).

export function patchCites(
  composedView: TurnOutput["composed_view"],
  map: Record<string, string>,
): TurnOutput["composed_view"] {
  if (!composedView) return null;
  return {
    sentences: composedView.sentences.map((s) => ({
      text: s.text,
      cites: s.cites.map((c) => map[c] ?? c),
    })),
  };
}

export function patchGapTargets(
  gap: TurnOutput["next_gap"],
  map: Record<string, string>,
): TurnOutput["next_gap"] {
  if (!gap) return null;
  return {
    ...gap,
    target_node_ids: gap.target_node_ids.map((c) => map[c] ?? c),
  };
}
