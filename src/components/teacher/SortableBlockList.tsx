"use client";

// Drag-reorder + delete client wrappers for the lesson composer's block
// list. The visual layout of each block stays in the server <Block>
// component; this file adds:
//
//   - a drag handle (left gutter "::" affordance)
//   - a delete button (right-aligned "✕")
//   - the dnd-kit sortable plumbing
//
// On drop, calls the reorderBlock server action with the destination
// index. The page revalidates and Next.js re-renders the list from
// Postgres. No optimistic UI; the drag releases, the server confirms,
// the list updates. Matches the rest of the planner's discipline.
//
// Why dnd-kit instead of HTML5 native drag: a11y handling, keyboard
// support, and pointer-vs-touch dispatch are all solved. ~12kB cost.

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { reorderBlock, deleteBlock } from "@/app/actions/teacher";
import { tokens } from "@/lib/design/tokens";

export type SortableBlockMeta = {
  id: string;
  // The label shown in the drag handle's accessible name. Not visible.
  label: string;
};

export function SortableBlockList({
  lessonId,
  blocks,
  children,
}: {
  lessonId: string;
  blocks: SortableBlockMeta[];
  children: ReactNode[];
}) {
  // Local ordering — optimistic during the drag, then revalidated by the
  // server action. We track the live id sequence so dnd-kit can animate.
  //
  // After addBlockToLesson / deleteBlock revalidates, the page re-renders
  // with a new `blocks` prop. Without this effect, our local `order` state
  // would still reference the pre-mutation id list and the new block would
  // be silently skipped. Sync on every prop change — `incomingOrder` is a
  // stable string so the effect only fires when the ids actually change,
  // not on every parent re-render.
  const incomingOrder = blocks.map((b) => b.id).join("|");
  const [order, setOrder] = useState<string[]>(() => blocks.map((b) => b.id));
  const [, startTransition] = useTransition();

  useEffect(() => {
    setOrder(blocks.map((b) => b.id));
    // We deliberately depend on the serialized id list, not the array
    // identity, so a parent re-render with the same blocks doesn't reset
    // an in-progress drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 5px movement threshold so a click on the delete button next to
      // the drag handle doesn't accidentally pick up a drag.
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromIndex = order.indexOf(String(active.id));
    const toIndex = order.indexOf(String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;

    const nextOrder = arrayMove(order, fromIndex, toIndex);
    setOrder(nextOrder);

    startTransition(async () => {
      try {
        await reorderBlock(lessonId, String(active.id), toIndex);
      } catch (err) {
        // Revert if the server rejects.
        setOrder(order);
        console.error("[SortableBlockList] reorder failed:", err);
      }
    });
  }

  // Index children by block id so we can render them in the live order.
  // The caller passes children in the SAME order as `blocks`, so we map
  // id → child via index.
  const childByIdInitial = new Map<string, ReactNode>();
  blocks.forEach((b, i) => childByIdInitial.set(b.id, children[i]));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        {order.map((id, i) => {
          const meta = blocks.find((b) => b.id === id);
          if (!meta) return null;
          return (
            <SortableBlockItem
              key={id}
              id={id}
              label={meta.label}
              isLast={i === order.length - 1}
              lessonId={lessonId}
            >
              {childByIdInitial.get(id)}
            </SortableBlockItem>
          );
        })}
      </SortableContext>
    </DndContext>
  );
}

function SortableBlockItem({
  id,
  label,
  isLast,
  lessonId,
  children,
}: {
  id: string;
  label: string;
  isLast: boolean;
  lessonId: string;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: "flex",
    gap: 14,
    alignItems: "stretch",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle + timeline gutter — drag-grab icon on hover, the
          existing 5px dot + 1px connector underneath. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 14,
          width: 18,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          aria-label={`Drag ${label}`}
          {...attributes}
          {...listeners}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            width: 16,
            height: 16,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "grab",
            color: tokens.color.faint,
            fontFamily: tokens.font.ui,
            fontSize: 10,
            lineHeight: 1,
          }}
        >
          <span aria-hidden="true">⋮⋮</span>
        </button>
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: tokens.color.border,
            flexShrink: 0,
            marginTop: 4,
          }}
        />
        {!isLast && (
          <div
            style={{
              width: 1,
              flex: 1,
              minHeight: 24,
              background: tokens.color.border,
              opacity: 0.6,
              marginTop: 4,
            }}
          />
        )}
      </div>

      <div
        style={{
          flex: 1,
          paddingBottom: 18,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {children}
        <DeleteBlockButton lessonId={lessonId} blockId={id} label={label} />
      </div>
    </div>
  );
}

function DeleteBlockButton({
  lessonId,
  blockId,
  label,
}: {
  lessonId: string;
  blockId: string;
  label: string;
}) {
  // Confirmation lives in the form's onSubmit. Native confirm() — no
  // modal lib. Cancelling preventDefault aborts the submission so the
  // server action is never called.
  return (
    <form
      action={deleteBlock}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Delete this ${label.toLowerCase()} block? This can't be undone in v0.`,
        );
        if (!ok) e.preventDefault();
      }}
      style={{ alignSelf: "flex-end" }}
    >
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="blockId" value={blockId} />
      <button
        type="submit"
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: tokens.color.faint,
          background: "transparent",
          border: "none",
          fontFamily: tokens.font.ui,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
          padding: "2px 0",
        }}
      >
        ✕ Delete
      </button>
    </form>
  );
}
