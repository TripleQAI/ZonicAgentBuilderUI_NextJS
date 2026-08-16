'use client';

import { EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react';
import { useCallback, useRef, useState } from 'react';

import { useWorkflowStore } from '@/store/useWorkflowStore';

/**
 * The one genuinely custom piece of the canvas (MIGRATION_PLAN.md §9.4, R3).
 *
 * The source let users drag the midpoint of a cubic bezier and persisted the
 * displacement in `edge.data.offset`, so a saved workflow reopens with its
 * curves exactly as arranged. React Flow's built-in edges have no such notion,
 * so the original path formulas are reproduced here verbatim:
 *
 *   dx    = max(|tx - sx| * 0.5, 60)
 *   path  = M sx sy C sx+dx+ox sy+oy, tx-dx+ox ty+oy, tx ty
 *   mid   = ((sx+tx)/2 + 0.75*ox, (sy+ty)/2 + 0.75*oy)
 *
 * The midpoint expression is the analytic value of the curve at t = 0.5, which
 * is why the drag handle tracks the visual centre of the bend rather than
 * drifting away from it.
 *
 * Hovering the wire also reveals a delete button, as the source did. There it
 * was an SVG circle inside the edge's own `<g>`, so moving between the wire and
 * the button never left the group and the button never flickered. React Flow
 * portals overlay content out of the SVG, so the same continuity is had by
 * anchoring the two controls edge-to-edge in one hover target that straddles
 * the midpoint — the wire passes underneath it.
 */

interface Offset {
  x: number;
  y: number;
}

/** Grip diameter in px. The controls are laid out from it, so it is named. */
const GRIP_SIZE = 10;

function bezierPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  offset: Offset,
): string {
  const dx = Math.max(Math.abs(tx - sx) * 0.5, 60);
  return `M ${sx} ${sy} C ${sx + dx + offset.x} ${sy + offset.y}, ${tx - dx + offset.x} ${
    ty + offset.y
  }, ${tx} ${ty}`;
}

function bezierMid(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  offset: Offset,
): Offset {
  return {
    x: (sx + tx) / 2 + 0.75 * offset.x,
    y: (sy + ty) / 2 + 0.75 * offset.y,
  };
}

export function BendableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const setEdgeOffset = useWorkflowStore((s) => s.setEdgeOffset);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const isReadOnly = useWorkflowStore((s) => s.isReadOnly);
  const { getZoom } = useReactFlow();
  const dragStart = useRef<{ x: number; y: number; offset: Offset } | null>(null);
  const [hovered, setHovered] = useState(false);

  const offset = ((data as { offset?: Offset } | undefined)?.offset ?? {
    x: 0,
    y: 0,
  }) satisfies Offset;

  const path = bezierPath(sourceX, sourceY, targetX, targetY, offset);
  const mid = bezierMid(sourceX, sourceY, targetX, targetY, offset);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (isReadOnly) return;
      event.stopPropagation();
      event.preventDefault();
      const zoom = getZoom() || 1;
      dragStart.current = { x: event.clientX, y: event.clientY, offset };

      const onMove = (move: PointerEvent) => {
        if (!dragStart.current) return;
        // Divide by zoom so a drag moves the bend by the same flow-space
        // distance whatever the canvas scale.
        setEdgeOffset(id, {
          x: dragStart.current.offset.x + (move.clientX - dragStart.current.x) / zoom,
          y: dragStart.current.offset.y + (move.clientY - dragStart.current.y) / zoom,
        });
      };
      const onUp = () => {
        dragStart.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [getZoom, id, isReadOnly, offset, setEdgeOffset],
  );

  const onDoubleClick = useCallback(() => {
    if (!isReadOnly) setEdgeOffset(id, { x: 0, y: 0 });
  }, [id, isReadOnly, setEdgeOffset]);

  const onDelete = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      // Without this the click reaches the pane and only deselects.
      event.stopPropagation();
      deleteEdge(id);
    },
    [deleteEdge, id],
  );

  // Selection counts as well as hover, so the button is reachable from the
  // keyboard path too: tab to the edge, then click what selection reveals.
  const showDelete = (hovered || Boolean(selected)) && !isReadOnly;

  return (
    <>
      <path
        id={id}
        d={path}
        className="react-flow__edge-path"
        markerEnd={markerEnd}
        fill="none"
      />
      {/* A fat transparent stroke makes the thin curve easy to click. */}
      <path
        d={path}
        fill="none"
        strokeWidth={16}
        stroke="transparent"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      <EdgeLabelRenderer>
        {/* Anchored by its left edge rather than centred, so the grip stays put
            on the midpoint whether or not the delete button is showing. */}
        <div
          className="nodrag nopan pointer-events-auto absolute flex items-center"
          style={{
            transform: `translate(0, -50%) translate(${mid.x - GRIP_SIZE / 2}px, ${mid.y}px)`,
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            type="button"
            title="Drag to bend · double-click to straighten"
            onPointerDown={onPointerDown}
            onDoubleClick={onDoubleClick}
            className="h-2.5 w-2.5 shrink-0 cursor-grab rounded-full border transition-opacity"
            style={{
              background: selected ? 'var(--accent)' : 'var(--bg-panel)',
              borderColor: selected ? 'var(--accent)' : 'var(--border-color)',
              opacity: selected || hovered || offset.x !== 0 || offset.y !== 0 ? 1 : 0.35,
            }}
          />

          {showDelete && (
            <button
              type="button"
              title="Delete connection"
              aria-label="Delete connection"
              onClick={onDelete}
              onPointerDown={(event) => event.stopPropagation()}
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-border bg-panel text-[9px] text-text-primary transition-colors hover:border-danger hover:bg-danger hover:text-panel"
            >
              <i className="bi-x-lg" />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
