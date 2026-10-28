'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { useCallback, useMemo, type DragEvent } from 'react';

import { BendableEdge } from '@/components/canvas/BendableEdge';
import { ContainerNode } from '@/components/canvas/ContainerNode';
import { containerSize, memberPosition, type Size } from '@/components/canvas/containerLayout';
import { RegistryNode, type RegistryNodeData } from '@/components/canvas/RegistryNode';
import { canJoin, containerSpec, effectiveEntry, memberIds } from '@/lib/registry/containers';
import { deriveHandles } from '@/lib/registry/nodeHandles';
import { nodeColor } from '@/lib/registry/nodePresentation';
import { getDotPath } from '@/lib/utils/dotPath';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { DerivedHandle } from '@/lib/registry/nodeHandles';
import type { WorkflowEdge, WorkflowNode } from '@/types/agent';

const nodeTypes = { registry: RegistryNode, container: ContainerNode };
const edgeTypes = { bendable: BendableEdge };

export const PALETTE_DND_TYPE = 'application/x-zonic-node-type';

/** Stored node -> React Flow node. The shapes already line up. */
function toFlowNode(
  node: WorkflowNode,
  handles: { targets: DerivedHandle[]; sources: DerivedHandle[] },
  childLabel: string | null,
  childResolved: boolean | null,
): Node<RegistryNodeData> {
  return {
    id: node.id,
    type: 'registry',
    position: node.position ?? { x: 0, y: 0 },
    selected: Boolean(node.selected),
    data: {
      name: node.name,
      nodeType: node.type,
      targets: handles.targets,
      sources: handles.sources,
      childLabel,
      childResolved,
    },
  };
}

function toFlowEdge(edge: WorkflowEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    type: 'bendable',
    selected: Boolean(edge.selected),
    data: { offset: edge.data?.offset ?? { x: 0, y: 0 } },
    markerEnd: 'url(#zonic-arrow)',
  };
}

function CanvasInner({ onOpenSubFlow }: { onOpenSubFlow: (childId: string) => void }) {
  const agent = useWorkflowStore((s) => s.currentAgent);
  const relationshipMap = useWorkflowStore((s) => s.relationshipMap);
  const allAgentsById = useWorkflowStore((s) => s.allAgentsById);
  const isReadOnly = useWorkflowStore((s) => s.isReadOnly);

  const addNode = useWorkflowStore((s) => s.addNode);
  const moveNode = useWorkflowStore((s) => s.moveNode);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const addEdge = useWorkflowStore((s) => s.addEdge);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const selectEdge = useWorkflowStore((s) => s.selectEdge);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);

  const addNodeInto = useWorkflowStore((s) => s.addNodeInto);
  const { screenToFlowPosition } = useReactFlow();
  // Every node's measured size: swarm frames fit their members with it, and each
  // node gets its size back when the list is rebuilt (React Flow hides a node it
  // has not measured, and does not measure again a node whose size is unchanged).
  // Selected as a string so the canvas re-renders only when a size changes.
  const measuredKey = useStore((state) =>
    [...state.nodeLookup.values()]
      .filter((n) => n.measured.width && n.measured.height)
      .map((n) => `${n.id}:${Math.round(n.measured.width!)}x${Math.round(n.measured.height!)}`)
      .join('|'),
  );
  const measured = useMemo(() => {
    const sizes = new Map<string, Size>();
    for (const entry of measuredKey ? measuredKey.split('|') : []) {
      const [id, size] = entry.split(':');
      const [width, height] = size.split('x').map(Number);
      sizes.set(id, { width, height });
    }
    return sizes;
  }, [measuredKey]);
  const semantics = useWorkflowStore((s) => s.nodeSemantics);
  const registry = useWorkflowStore((s) => s.nodeRegistry);

  /** Sub Flow nodes show their child's name and whether it resolved. */
  const childInfo = useCallback(
    (node: WorkflowNode): [string | null, boolean | null] => {
      // Which types reference a child, and where they keep the id, is declared
      // in node_semantics.json rather than assumed here.
      const path = semantics.childReference?.[node.type];
      if (!path) return [null, null];
      const childId = (getDotPath(node, path) as string | undefined) ?? null;
      if (!childId) return [null, null];
      const known = allAgentsById[childId];
      if (known) {
        return [String(known.displayName ?? known.name ?? childId), true];
      }
      const entry = [
        ...(relationshipMap?.resolved ?? []),
        ...(relationshipMap?.unresolved ?? []),
      ].find((r) => r.sourceNodeId === node.id);
      if (entry?.isResolved && entry.childAgent) {
        return [entry.childAgent.displayName || entry.childAgent.name, true];
      }
      return ['Unresolved child', false];
    },
    [allAgentsById, relationshipMap, semantics],
  );

  const nodes = useMemo(() => {
    const stored = agent?.nodes ?? [];
    // Handoff handles are labelled with the target node's name.
    const names = Object.fromEntries(stored.map((n) => [n.id, n.name]));
    const ids = new Set(stored.map((n) => n.id));
    const isMember = (n: WorkflowNode) => Boolean(n.parentId && ids.has(n.parentId));
    const membersOf = new Map<string, WorkflowNode[]>();
    for (const n of stored)
      if (isMember(n)) membersOf.set(n.parentId!, [...(membersOf.get(n.parentId!) ?? []), n]);
    const entries = new Set(
      stored.flatMap((n) => {
        const spec = containerSpec(semantics, n.type);
        const entry = spec ? effectiveEntry(n, spec) : undefined;
        return entry ? [entry] : [];
      }),
    );
    // React Flow draws a parent before its children: containers first, members last.
    return [...stored.filter((n) => !isMember(n)), ...stored.filter(isMember)].map((n) => {
      const definition = registry.find((t) => t.type === n.type);
      const member = isMember(n);
      const spec = containerSpec(semantics, n.type);
      const flowNode = toFlowNode(
        n,
        // A member hands off at run time and has no connections.
        member
          ? { targets: [], sources: [] }
          : deriveHandles(n, definition, semantics, names, agent?.edges ?? []),
        ...childInfo(n),
      );
      const size = measured.get(n.id);
      if (size) flowNode.measured = size;
      if (member) {
        flowNode.parentId = n.parentId;
        flowNode.position = memberPosition(n.position);
        flowNode.extent = 'parent';
        flowNode.data.isEntry = entries.has(n.id);
      }
      if (spec && definition?.layout?.kind === 'container') {
        const members = membersOf.get(n.id) ?? [];
        const entry = effectiveEntry(n, spec);
        flowNode.type = 'container';
        Object.assign(flowNode, containerSize(definition.layout, members, measured));
        flowNode.data = {
          ...flowNode.data,
          memberCount: memberIds(n, spec).length,
          entryName: entry ? names[entry] : undefined,
        };
      }
      return flowNode;
    });
    // `registry` is a dependency on purpose: it arrives asynchronously, and the
    // handles cannot be derived until it does.
  }, [agent?.nodes, agent?.edges, childInfo, measured, registry, semantics]);
  const edges = useMemo(() => (agent?.edges ?? []).map(toFlowEdge), [agent?.edges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position && !isReadOnly) {
          moveNode(change.id, change.position);
        } else if (change.type === 'remove' && !isReadOnly) {
          deleteNode(change.id);
        } else if (change.type === 'select') {
          if (change.selected) selectNode(change.id);
        }
      }
    },
    [deleteNode, isReadOnly, moveNode, selectNode],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove' && !isReadOnly) deleteEdge(change.id);
        else if (change.type === 'select' && change.selected) selectEdge(change.id);
      }
    },
    [deleteEdge, isReadOnly, selectEdge],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (isReadOnly || !connection.source || !connection.target) return;
      addEdge(
        connection.source,
        connection.sourceHandle ?? null,
        connection.target,
        connection.targetHandle ?? null,
      );
    },
    [addEdge, isReadOnly],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (isReadOnly) return;
      const nodeType = event.dataTransfer.getData(PALETTE_DND_TYPE);
      if (!nodeType) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      // Dropped onto a swarm that accepts this node type: it joins the swarm.
      const target = nodes.findLast((n) => {
        if (n.type !== 'container') return false;
        const stored = agent?.nodes.find((s) => s.id === n.id);
        const { width = 0, height = 0 } = n;
        return (
          stored !== undefined &&
          canJoin(semantics, stored, nodeType) &&
          position.x >= n.position.x &&
          position.x <= n.position.x + width &&
          position.y >= n.position.y &&
          position.y <= n.position.y + height
        );
      });
      const created = target ? addNodeInto(nodeType, position, target.id) : addNode(nodeType, position);
      if (created) selectNode(created.id);
    },
    [addNode, addNodeInto, agent?.nodes, isReadOnly, nodes, screenToFlowPosition, selectNode, semantics],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const stored = agent?.nodes.find((n) => n.id === node.id);
      const path = stored ? semantics.childReference?.[stored.type] : undefined;
      if (!stored || !path) return;
      const childId = getDotPath(stored, path) as string | undefined;
      if (childId) onOpenSubFlow(childId);
    },
    [agent?.nodes, onOpenSubFlow, semantics],
  );

  return (
    <div className="relative h-full w-full" onDrop={onDrop} onDragOver={onDragOver}>
      {/* One shared arrowhead marker, matching the source's SVG defs. */}
      <svg className="absolute h-0 w-0">
        <defs>
          <marker
            id="zonic-arrow"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)" />
          </marker>
        </defs>
      </svg>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={clearSelection}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        elementsSelectable
        deleteKeyCode={isReadOnly ? null : ['Backspace', 'Delete']}
        minZoom={0.2}
        maxZoom={2}
        fitView
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{
          stroke: 'var(--accent)',
          strokeWidth: 2,
          strokeDasharray: '6 3',
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          // The dot grid is part of the palette, so it reads a token.
          color="var(--border-color)"
        />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const data = node.data as RegistryNodeData;
            return nodeColor(useWorkflowStore.getState().getNodeTypeDef(data.nodeType));
          }}
          maskColor="rgba(19,19,31,.7)"
        />
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas(props: { onOpenSubFlow: (childId: string) => void }) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
