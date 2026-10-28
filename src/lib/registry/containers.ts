/**
 * Container nodes (a swarm), read through the `swarms` node semantics.
 *
 * Ported from the Strands Visual Builder (`registry/containers.ts`). The canvas,
 * the store, the member list field and the mock engine find members here, so no
 * code names a container type. A container keeps its members as a list of node
 * IDs at `membersPath`; each member also carries `parentId`, which only places it
 * on the canvas. When the two disagree, the list wins.
 */

import type { ContainerSpec, NodeSemantics } from '@/lib/registry/nodeSemantics';
import { getDotPath, setDotPath } from '@/lib/utils/dotPath';
import type { AgentDraft, Position, WorkflowNode } from '@/types/agent';

export function containerSpec(semantics: NodeSemantics, nodeType: string): ContainerSpec | undefined {
  return semantics.swarms?.[nodeType];
}

export function memberIds(node: WorkflowNode, spec: ContainerSpec): string[] {
  const value = getDotPath(node, spec.membersPath);
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string' && id !== '')
    : [];
}

export function entryPoint(node: WorkflowNode, spec: ContainerSpec): string {
  const value = getDotPath(node, spec.entryPointPath);
  return typeof value === 'string' ? value : '';
}

/** The member a run starts at: the entry point, else the first member. */
export function effectiveEntry(node: WorkflowNode, spec: ContainerSpec): string | undefined {
  const members = memberIds(node, spec);
  const entry = entryPoint(node, spec);
  return members.includes(entry) ? entry : members[0];
}

export function containers(
  draft: AgentDraft,
  semantics: NodeSemantics,
): { node: WorkflowNode; spec: ContainerSpec }[] {
  return draft.nodes.flatMap((node) => {
    const spec = containerSpec(semantics, node.type);
    return spec ? [{ node, spec }] : [];
  });
}

/** The container that lists this node as a member, if any. */
export function containerOf(
  draft: AgentDraft,
  semantics: NodeSemantics,
  nodeId: string,
): WorkflowNode | undefined {
  return containers(draft, semantics).find(({ node, spec }) => memberIds(node, spec).includes(nodeId))
    ?.node;
}

/** Whether a node of `nodeType` may be a member of `container`. */
export function canJoin(semantics: NodeSemantics, container: WorkflowNode, nodeType: string): boolean {
  return Boolean(containerSpec(semantics, container.type)?.memberTypes.includes(nodeType));
}

export const toRelative = (position: Position, container: WorkflowNode): Position => ({
  x: position.x - container.position.x,
  y: position.y - container.position.y,
});

export const toAbsolute = (position: Position, container: WorkflowNode): Position => ({
  x: position.x + container.position.x,
  y: position.y + container.position.y,
});

/**
 * Makes `parentId` follow the members lists (run on load; the list wins). A node
 * listed by two containers stays with the first; a listed ID with no node is
 * dropped; an entry point that is not a member is cleared. Positions are converted
 * so every node stays where it was drawn.
 */
export function repairContainers(draft: AgentDraft, semantics: NodeSemantics): void {
  const owner = new Map<string, string>();
  for (const { node, spec } of containers(draft, semantics)) {
    const listed = memberIds(node, spec);
    const members = listed.filter((id) => !owner.has(id) && draft.nodes.some((n) => n.id === id));
    if (members.length !== listed.length)
      setDotPath(node as unknown as Record<string, unknown>, spec.membersPath, members);
    members.forEach((id) => owner.set(id, node.id));
    const entry = entryPoint(node, spec);
    if (entry && !members.includes(entry))
      setDotPath(node as unknown as Record<string, unknown>, spec.entryPointPath, '');
  }
  const byId = new Map(draft.nodes.map((node) => [node.id, node]));
  for (const node of draft.nodes) {
    const listedIn = owner.get(node.id);
    if (node.parentId === listedIn) continue;
    const oldParent = node.parentId ? byId.get(node.parentId) : undefined;
    const absolute = oldParent ? toAbsolute(node.position, oldParent) : node.position;
    const newParent = listedIn ? byId.get(listedIn) : undefined;
    node.position = newParent ? toRelative(absolute, newParent) : absolute;
    if (listedIn) node.parentId = listedIn;
    else delete node.parentId;
  }
}
