/**
 * Where a container's (swarm's) members sit and how big its frame is.
 *
 * Members are stored relative to their container. They are drawn below the
 * header and inside the padding whatever their stored position, and the frame
 * grows to fit them, so a member never sits on the header and a frame never
 * cuts one off. Nothing here changes the document until a node is moved.
 */

import type { Position, WorkflowNode } from '@/types/agent';

/** The frame's header band; its handles sit level with the header's middle. */
export const CONTAINER_HEADER_HEIGHT = 56;
/** Space kept between the frame's edges and its members. */
export const CONTAINER_PADDING = 16;
/** A member card's size before React Flow has measured it. */
export const MEMBER_FALLBACK_SIZE = { width: 180, height: 54 } as const;
/** A frame's size when its node type's layout gives none. */
export const CONTAINER_FALLBACK_SIZE = { width: 420, height: 160 } as const;

export interface Size {
  width: number;
  height: number;
}

/** A member's position, kept below the header and inside the padding. */
export function memberPosition(position: Position | undefined): Position {
  const { x, y } = position ?? { x: 0, y: 0 };
  return {
    x: Math.max(x, CONTAINER_PADDING),
    y: Math.max(y, CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING),
  };
}

/** The room the members need: their furthest edges plus the padding. */
export function membersExtent(
  members: readonly WorkflowNode[],
  measured: ReadonlyMap<string, Size>,
): Size {
  let width = 0;
  let height = 0;
  for (const member of members) {
    const { x, y } = memberPosition(member.position);
    const size = measured.get(member.id);
    width = Math.max(width, x + (size?.width || MEMBER_FALLBACK_SIZE.width) + CONTAINER_PADDING);
    height = Math.max(height, y + (size?.height || MEMBER_FALLBACK_SIZE.height) + CONTAINER_PADDING);
  }
  return { width, height };
}

/**
 * A container's frame: its layout minimum, and always room for its members.
 * The stored size is not used: the frame follows its members.
 */
export function containerSize(
  layout: { minWidth?: number; minHeight?: number } | null | undefined,
  members: readonly WorkflowNode[],
  measured: ReadonlyMap<string, Size>,
): Size {
  const fit = membersExtent(members, measured);
  return {
    width: Math.max(layout?.minWidth ?? CONTAINER_FALLBACK_SIZE.width, fit.width),
    height: Math.max(layout?.minHeight ?? CONTAINER_FALLBACK_SIZE.height, fit.height),
  };
}

/** Where a new member dropped at an absolute point lands, relative to its container. */
export function dropPosition(point: Position, container: WorkflowNode): Position {
  return memberPosition({ x: point.x - container.position.x, y: point.y - container.position.y });
}
