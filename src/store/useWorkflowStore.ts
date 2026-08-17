/**
 * Editor state. The direct analogue of the source's workflow_store.js.
 *
 * Selector subscriptions replace the jQuery event bus: nothing dispatches
 * `workflow-dirty` any more, because every mutating action sets `isDirty` and
 * the header re-renders from that.
 */

'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { emptyAgent, fromAgentJson } from '@/lib/serialization/agentDocument';
import type {
  AgentDocument,
  AgentDraft,
  Position,
  RelationshipMap,
  WorkflowEdge,
  WorkflowNode,
} from '@/types/agent';
import { handoffPathFor } from '@/lib/registry/nodeFields';
import { HANDOFF_PREFIX } from '@/lib/registry/nodeHandles';
import type { NodeSemantics } from '@/lib/registry/nodeSemantics';
import type { NodeTypeDef } from '@/types/registry';

function nextId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Auto-increment sibling names: llm_1, llm_2, ... — as the source did. */
function uniqueName(existing: WorkflowNode[], prefix: string): string {
  const taken = new Set(existing.map((n) => n.name));
  let counter = 1;
  while (taken.has(`${prefix}_${counter}`)) counter += 1;
  return `${prefix}_${counter}`;
}

function getDotPath(source: unknown, dotPath: string): unknown {
  let cursor: unknown = source;
  for (const key of dotPath.split('.')) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function setDotPath(target: Record<string, unknown>, dotPath: string, value: unknown): void {
  const keys = dotPath.split('.');
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (cursor[key] == null || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

/** `toolIndex` names the row whose MCP server is being configured. */
export interface ToolDialogRequest {
  kind: 'catalog' | 'mcp';
  nodeId: string;
  toolIndex: number | null;
}

export interface WorkflowState {
  currentAgent: AgentDraft | null;
  rootAgenticWorkflowId: string | null;
  allAgentsById: Record<string, AgentDocument>;
  relationshipMap: RelationshipMap | null;
  nodeRegistry: NodeTypeDef[];
  nodeSemantics: NodeSemantics;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isReadOnly: boolean;
  isDirty: boolean;
  /** Bumped whenever the properties form must re-read the node. */
  formEpoch: number;
  /** Which tool surface is open, if any. Held here rather than passed down
   *  because the button that opens it is a field inside the properties form
   *  and the dialog is mounted at the root. */
  toolDialog: ToolDialogRequest | null;

  setNodeRegistry: (types: NodeTypeDef[]) => void;
  setNodeSemantics: (semantics: NodeSemantics) => void;
  getNodeTypeDef: (type: string) => NodeTypeDef | undefined;
  /** Config and canvas edges for one node's handoffs, updated together.
   *  `path` is the field's own dot-path, so nothing here names a config key. */
  setHandoffTargets: (nodeId: string, path: string, targetIds: string[]) => void;

  loadAgent: (document: AgentDocument) => void;
  registerAgent: (document: AgentDocument) => void;
  setRootId: (id: string | null) => void;
  setRelationshipMap: (map: RelationshipMap | null) => void;
  newAgent: () => void;

  addNode: (type: string, position: Position) => WorkflowNode | null;
  updateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  updateNodePath: (nodeId: string, dotPath: string, value: unknown) => void;
  moveNode: (nodeId: string, position: Position) => void;
  deleteNode: (nodeId: string) => void;

  addEdge: (
    source: string,
    sourceHandle: string | null,
    target: string,
    targetHandle: string | null,
  ) => WorkflowEdge | null;
  updateEdge: (edgeId: string, patch: Partial<WorkflowEdge>) => void;
  setEdgeOffset: (edgeId: string, offset: Position) => void;
  deleteEdge: (edgeId: string) => void;

  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearSelection: () => void;

  patchAgent: (patch: Partial<AgentDraft>) => void;
  /** Re-seed the properties form from the node. Needed after a dialog writes a
   *  field the open form also holds, since react-hook-form owns its own copy. */
  refreshForm: () => void;
  openToolDialog: (request: ToolDialogRequest) => void;
  closeToolDialog: () => void;
  markDirty: () => void;
  markClean: () => void;
  setReadOnly: (value: boolean) => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  immer((set, get) => ({
    currentAgent: null,
    rootAgenticWorkflowId: null,
    allAgentsById: {},
    relationshipMap: null,
    nodeRegistry: [],
    nodeSemantics: {},
    selectedNodeId: null,
    selectedEdgeId: null,
    isReadOnly: false,
    isDirty: false,
    formEpoch: 0,
    toolDialog: null,

    setNodeRegistry: (types) =>
      set((state) => {
        state.nodeRegistry = types;
      }),

    setNodeSemantics: (semantics) =>
      set((state) => {
        state.nodeSemantics = semantics;
      }),

    getNodeTypeDef: (type) => get().nodeRegistry.find((t) => t.type === type),

    setHandoffTargets: (nodeId, path, targetIds) =>
      set((state) => {
        const agent = state.currentAgent;
        const node = agent?.nodes.find((n) => n.id === nodeId);
        if (!agent || !node || !path) return;

        const wanted = targetIds.filter(Boolean);
        setDotPath(node as unknown as Record<string, unknown>, path, wanted);

        // Drop edges for targets that are no longer listed.
        agent.edges = agent.edges.filter(
          (e) =>
            !(
              e.source === nodeId &&
              e.data?.handoff === true &&
              !wanted.includes(e.target)
            ),
        );

        // Add one edge per new target, on that target's own handle.
        for (const targetId of wanted) {
          const existing = agent.edges.find(
            (e) => e.source === nodeId && e.target === targetId,
          );
          if (existing) {
            // Re-use a wire that is already there rather than doubling it up.
            existing.sourceHandle = `${HANDOFF_PREFIX}${targetId}`;
            existing.data = { ...(existing.data ?? {}), handoff: true };
            continue;
          }
          agent.edges.push({
            id: nextId('edge'),
            source: nodeId,
            target: targetId,
            sourceHandle: `${HANDOFF_PREFIX}${targetId}`,
            targetHandle: null,
            type: 'default',
            data: {
              handoff: true,
              sourceType: node.type,
              targetType: agent.nodes.find((n) => n.id === targetId)?.type ?? null,
            },
            style: { strokeWidth: 3 },
            selected: false,
            deletable: true,
          });
        }

        state.isDirty = true;
      }),

    loadAgent: (document) =>
      set((state) => {
        state.currentAgent = fromAgentJson(document);
        state.allAgentsById[state.currentAgent.agenticWorkflowId] = document;
        state.selectedNodeId = null;
        state.selectedEdgeId = null;
        state.isDirty = false;
        state.formEpoch += 1;
      }),

    registerAgent: (document) =>
      set((state) => {
        state.allAgentsById[String(document.agenticWorkflowId)] = document;
      }),

    setRootId: (id) =>
      set((state) => {
        state.rootAgenticWorkflowId = id;
      }),

    setRelationshipMap: (map) =>
      set((state) => {
        state.relationshipMap = map;
      }),

    newAgent: () =>
      set((state) => {
        state.currentAgent = emptyAgent();
        state.rootAgenticWorkflowId = state.currentAgent.agenticWorkflowId;
        state.selectedNodeId = null;
        state.selectedEdgeId = null;
        state.isDirty = false;
        state.formEpoch += 1;
      }),

    addNode: (type, position) => {
      const definition = get().getNodeTypeDef(type);
      let created: WorkflowNode | null = null;
      set((state) => {
        if (!state.currentAgent) state.currentAgent = emptyAgent();
        const prefix = definition?.defaultNamePrefix || type;
        const node: WorkflowNode = {
          id: nextId(type),
          type,
          name: uniqueName(state.currentAgent.nodes, prefix),
          description: '',
          position,
          positionAbsolute: position,
          config: structuredClone(definition?.defaultConfig ?? {}),
          properties: {},
          variableUpdates: [],
          selected: false,
          dragging: false,
          deletable: true,
          width: 200,
          height: 80,
          style: {},
        };
        state.currentAgent.nodes.push(node);
        state.isDirty = true;
        created = node;
      });
      return created;
    },

    updateNode: (nodeId, patch) =>
      set((state) => {
        const node = state.currentAgent?.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        // `config` is merged, not replaced, so a caller can set one key without
        // dropping the rest. It has to be pulled out of the patch first —
        // assigning the whole patch would overwrite node.config, leaving the
        // merge below spreading the new value into itself. (The source app has
        // the same lines in the other order, which quietly makes its merge a
        // no-op; nothing there passed `config`, so it never showed.)
        const { config, ...rest } = patch;
        Object.assign(node, rest);
        if (config) node.config = { ...node.config, ...config };
        state.isDirty = true;
      }),

    updateNodePath: (nodeId, dotPath, value) =>
      set((state) => {
        const node = state.currentAgent?.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        setDotPath(node as unknown as Record<string, unknown>, dotPath, value);
        state.isDirty = true;
      }),

    moveNode: (nodeId, position) =>
      set((state) => {
        const node = state.currentAgent?.nodes.find((n) => n.id === nodeId);
        if (!node) return;
        node.position = position;
        node.positionAbsolute = position;
        state.isDirty = true;
      }),

    deleteNode: (nodeId) =>
      set((state) => {
        if (!state.currentAgent) return;
        state.currentAgent.nodes = state.currentAgent.nodes.filter((n) => n.id !== nodeId);
        state.currentAgent.edges = state.currentAgent.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId,
        );
        if (state.selectedNodeId === nodeId) state.selectedNodeId = null;
        state.isDirty = true;
      }),

    addEdge: (source, sourceHandle, target, targetHandle) => {
      let created: WorkflowEdge | null = null;
      set((state) => {
        const agent = state.currentAgent;
        if (!agent) return;
        const duplicate = agent.edges.some(
          (e) =>
            e.source === source &&
            e.target === target &&
            (e.sourceHandle ?? null) === (sourceHandle ?? null) &&
            (e.targetHandle ?? null) === (targetHandle ?? null),
        );
        if (duplicate) return;

        const edge: WorkflowEdge = {
          id: nextId('edge'),
          source,
          target,
          sourceHandle: sourceHandle ?? null,
          targetHandle: targetHandle ?? null,
          type: 'default',
          data: {
            sourceType: agent.nodes.find((n) => n.id === source)?.type ?? null,
            targetType: agent.nodes.find((n) => n.id === target)?.type ?? null,
          },
          style: { strokeWidth: 3 },
          selected: false,
          deletable: true,
        };
        agent.edges.push(edge);
        state.isDirty = true;
        created = edge;
      });
      return created;
    },

    updateEdge: (edgeId, patch) =>
      set((state) => {
        const edge = state.currentAgent?.edges.find((e) => e.id === edgeId);
        if (!edge) return;
        Object.assign(edge, patch);
        state.isDirty = true;
      }),

    setEdgeOffset: (edgeId, offset) =>
      set((state) => {
        const edge = state.currentAgent?.edges.find((e) => e.id === edgeId);
        if (!edge) return;
        edge.data = { ...(edge.data ?? {}), offset };
        state.isDirty = true;
      }),

    deleteEdge: (edgeId) =>
      set((state) => {
        const agent = state.currentAgent;
        if (!agent) return;
        const edge = agent.edges.find((e) => e.id === edgeId);

        // A handoff edge is the visible half of config.handoffTarget. Deleting
        // the wire has to remove the target too, or the node is left rendering
        // a handle that connects to nothing.
        if (edge?.data?.handoff === true) {
          const source = agent.nodes.find((n) => n.id === edge.source);
          const path = source
            ? (handoffPathFor(state.nodeRegistry.find((t) => t.type === source.type)) ??
              state.nodeSemantics.handoffTargets?.[source.type])
            : undefined;
          if (source && path) {
            const current = (getDotPath(source, path) ?? []) as string[];
            if (Array.isArray(current)) {
              setDotPath(
                source as unknown as Record<string, unknown>,
                path,
                current.filter((id) => id !== edge.target),
              );
            }
          }
        }

        agent.edges = agent.edges.filter((e) => e.id !== edgeId);
        if (state.selectedEdgeId === edgeId) state.selectedEdgeId = null;
        state.isDirty = true;
      }),

    selectNode: (nodeId) =>
      set((state) => {
        state.selectedNodeId = nodeId;
        state.selectedEdgeId = null;
        state.currentAgent?.nodes.forEach((n) => {
          n.selected = n.id === nodeId;
        });
        state.formEpoch += 1;
      }),

    selectEdge: (edgeId) =>
      set((state) => {
        state.selectedEdgeId = edgeId;
        state.selectedNodeId = null;
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedNodeId = null;
        state.selectedEdgeId = null;
        state.currentAgent?.nodes.forEach((n) => {
          n.selected = false;
        });
      }),

    patchAgent: (patch) =>
      set((state) => {
        if (!state.currentAgent) return;
        Object.assign(state.currentAgent, patch);
        state.isDirty = true;
      }),

    refreshForm: () =>
      set((state) => {
        state.formEpoch += 1;
      }),

    openToolDialog: (request) =>
      set((state) => {
        state.toolDialog = request;
      }),

    closeToolDialog: () =>
      set((state) => {
        state.toolDialog = null;
      }),

    markDirty: () =>
      set((state) => {
        state.isDirty = true;
      }),

    markClean: () =>
      set((state) => {
        state.isDirty = false;
      }),

    setReadOnly: (value) =>
      set((state) => {
        state.isReadOnly = value;
      }),
  })),
);

/** Selector helpers, so components subscribe to the smallest slice they need. */
export const selectCurrentAgent = (s: WorkflowState) => s.currentAgent;
export const selectSelectedNode = (s: WorkflowState) =>
  s.currentAgent?.nodes.find((n) => n.id === s.selectedNodeId) ?? null;
export const selectNodeCount = (s: WorkflowState) => s.currentAgent?.nodes.length ?? 0;
export const selectEdgeCount = (s: WorkflowState) => s.currentAgent?.edges.length ?? 0;
