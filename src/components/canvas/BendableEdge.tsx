'use client';

import { EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react';
import { useCallback, useRef } from 'react';

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
 */

interface Offset {
  x: number;
  y: number;
}

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
  const isReadOnly = useWorkflowStore((s) => s.isReadOnly);
  const { getZoom } = useReactFlow();
  const dragStart = useRef<{ x: number; y: number; offset: Offset } | null>(null);

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
      <path d={path} fill="none" strokeWidth={16} stroke="transparent" />

      <EdgeLabelRenderer>
        <button
          type="button"
          title="Drag to bend · double-click to straighten"
          onPointerDown={onPointerDown}
          onDoubleClick={onDoubleClick}
          className="nodrag nopan pointer-events-auto absolute h-2.5 w-2.5 cursor-grab rounded-full border transition-opacity"
          style={{
            transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
            background: selected ? 'var(--accent)' : 'var(--bg-panel)',
            borderColor: selected ? 'var(--accent)' : 'var(--border-color)',
            opacity: selected || offset.x !== 0 || offset.y !== 0 ? 1 : 0.35,
          }}
        />
      </EdgeLabelRenderer>
    </>
  );
}
