'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { useCallback, useMemo, type DragEvent } from 'react';

import { BendableEdge } from '@/components/canvas/BendableEdge';
import { RegistryNode, type RegistryNodeData } from '@/components/canvas/RegistryNode';
import { nodeColor } from '@/lib/registry/nodePresentation';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { WorkflowEdge, WorkflowNode } from '@/types/agent';

const nodeTypes = { registry: RegistryNode };
const edgeTypes = { bendable: BendableEdge };

export const PALETTE_DND_TYPE = 'application/x-zonic-node-type';

/** Stored node -> React Flow node. The shapes already line up. */
function toFlowNode(
  node: WorkflowNode,
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

  const { screenToFlowPosition } = useReactFlow();

  /** Sub Flow nodes show their child's name and whether it resolved. */
  const childInfo = useCallback(
    (node: WorkflowNode): [string | null, boolean | null] => {
      if (node.type !== 'workflow') return [null, null];
      const childId = (node.config?.agenticWorkflowId as string | undefined) ?? null;
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
    [allAgentsById, relationshipMap],
  );

  const nodes = useMemo(
    () => (agent?.nodes ?? []).map((n) => toFlowNode(n, ...childInfo(n))),
    [agent?.nodes, childInfo],
  );
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
      const created = addNode(nodeType, position);
      if (created) selectNode(created.id);
    },
    [addNode, isReadOnly, screenToFlowPosition, selectNode],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const stored = agent?.nodes.find((n) => n.id === node.id);
      if (stored?.type !== 'workflow') return;
      const childId = stored.config?.agenticWorkflowId as string | undefined;
      if (childId) onOpenSubFlow(childId);
    },
    [agent?.nodes, onOpenSubFlow],
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
