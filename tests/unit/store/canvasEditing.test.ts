import { beforeEach, describe, expect, it } from 'vitest';

import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { AgentDocument } from '@/types/agent';
import type { NodeTypeDef } from '@/types/registry';

/**
 * Node and edge editing — the operations every canvas interaction goes
 * through. The store is the only writer, so these are the rules the canvas,
 * the properties panel and the save payload all inherit.
 */

const LLM: NodeTypeDef = {
  type: 'llm',
  label: 'LLM',
  icon: 'bi-cpu-fill',
  color: '#3b82f6',
  description: '',
  defaultNamePrefix: 'LLM',
  defaultConfig: { model: 'claude-sonnet-4-6', messages: [] },
  handles: { sources: [{ id: 'default', position: 'bottom' }], targets: [] },
  formSchema: {},
  outputSchema: {},
  validationSchema: {},
  sortOrder: 2,
};

const DOCUMENT: AgentDocument = {
  agenticWorkflowId: 'wf-1',
  name: 'demo',
  displayName: 'Demo',
  nodes: [
    { id: 'a', type: 'llm', name: 'A', config: {}, position: { x: 0, y: 0 } },
    { id: 'b', type: 'llm', name: 'B', config: {}, position: { x: 0, y: 0 } },
  ],
  edges: [{ id: 'e1', source: 'a', target: 'b', sourceHandle: 'default' }],
};

const store = () => useWorkflowStore.getState();
const agent = () => store().currentAgent!;

beforeEach(() => {
  useWorkflowStore.setState({ nodeRegistry: [LLM] });
  store().loadAgent(structuredClone(DOCUMENT));
});

describe('adding a node', () => {
  it('copies the registry defaults rather than sharing them', () => {
    const first = store().addNode('llm', { x: 10, y: 20 })!;
    const second = store().addNode('llm', { x: 30, y: 40 })!;

    expect(first.config).toEqual(LLM.defaultConfig);
    // Sharing one object would let an edit on one node change every other node
    // of that type — and the registry entry itself.
    store().updateNode(first.id, { config: { model: 'changed' } });

    expect((agent().nodes.find((n) => n.id === second.id)!.config as { model: string }).model)
      .toBe('claude-sonnet-4-6');
    expect(LLM.defaultConfig.model).toBe('claude-sonnet-4-6');
  });

  it('numbers siblings from the type prefix', () => {
    expect(store().addNode('llm', { x: 0, y: 0 })!.name).toBe('LLM_1');
    expect(store().addNode('llm', { x: 0, y: 0 })!.name).toBe('LLM_2');
  });

  it('fills the lowest free number rather than always counting up', () => {
    store().addNode('llm', { x: 0, y: 0 }); // LLM_1
    store().addNode('llm', { x: 0, y: 0 }); // LLM_2
    store().deleteNode(agent().nodes.find((n) => n.name === 'LLM_1')!.id);

    expect(store().addNode('llm', { x: 0, y: 0 })!.name).toBe('LLM_1');
  });

  it('falls back to the raw type when the registry has no entry', () => {
    expect(store().addNode('mystery', { x: 0, y: 0 })!.name).toBe('mystery_1');
  });

  it('records the drop position', () => {
    const created = store().addNode('llm', { x: 120, y: 340 })!;
    expect(created.position).toEqual({ x: 120, y: 340 });
  });
});

describe('deleting a node', () => {
  it('takes its edges with it', () => {
    store().deleteNode('a');
    expect(agent().nodes.map((n) => n.id)).toEqual(['b']);
    // An edge to a node that no longer exists would render as a dangling line.
    expect(agent().edges).toHaveLength(0);
  });

  it('clears the selection when the selected node goes', () => {
    store().selectNode('a');
    store().deleteNode('a');
    expect(store().selectedNodeId).toBeNull();
  });

  it('leaves a different selection alone', () => {
    store().selectNode('b');
    store().deleteNode('a');
    expect(store().selectedNodeId).toBe('b');
  });
});

describe('editing a node', () => {
  it('merges config instead of replacing it', () => {
    store().updateNode('a', { config: { model: 'x' } });
    store().updateNode('a', { config: { temperature: 0.5 } });
    expect(agent().nodes[0].config).toEqual({ model: 'x', temperature: 0.5 });
  });

  it('writes a dot-path, creating what it needs', () => {
    store().updateNodePath('a', 'config.advanced.retries', 3);
    expect(agent().nodes[0].config).toEqual({ advanced: { retries: 3 } });
  });

  it('ignores an unknown node id', () => {
    expect(() => store().updateNodePath('ghost', 'config.x', 1)).not.toThrow();
  });

  it('keeps position and positionAbsolute together', () => {
    store().moveNode('a', { x: 5, y: 6 });
    expect(agent().nodes[0].position).toEqual({ x: 5, y: 6 });
    expect(agent().nodes[0].positionAbsolute).toEqual({ x: 5, y: 6 });
  });
});

describe('edges', () => {
  it('refuses an exact duplicate', () => {
    expect(store().addEdge('a', 'default', 'b', null)).toBeNull();
    expect(agent().edges).toHaveLength(1);
  });

  it('allows a second edge from a different handle', () => {
    expect(store().addEdge('a', 'other', 'b', null)).not.toBeNull();
    expect(agent().edges).toHaveLength(2);
  });

  it('records the endpoint types, which the export carries', () => {
    const edge = store().addEdge('b', 'default', 'a', null)!;
    expect(edge.data?.sourceType).toBe('llm');
    expect(edge.data?.targetType).toBe('llm');
  });

  it('persists a dragged bend', () => {
    store().setEdgeOffset('e1', { x: 40, y: -12 });
    expect(agent().edges[0].data?.offset).toEqual({ x: 40, y: -12 });
  });
});

describe('the unsaved marker', () => {
  it('starts clean after a load', () => {
    expect(store().isDirty).toBe(false);
  });

  it.each([
    ['addNode', () => store().addNode('llm', { x: 0, y: 0 })],
    ['updateNode', () => store().updateNode('a', { name: 'renamed' })],
    ['updateNodePath', () => store().updateNodePath('a', 'config.x', 1)],
    ['moveNode', () => store().moveNode('a', { x: 1, y: 1 })],
    ['deleteNode', () => store().deleteNode('a')],
    ['addEdge', () => store().addEdge('b', 'default', 'a', null)],
    ['deleteEdge', () => store().deleteEdge('e1')],
    ['setEdgeOffset', () => store().setEdgeOffset('e1', { x: 1, y: 1 })],
    ['patchAgent', () => store().patchAgent({ displayName: 'x' })],
  ])('%s marks the workflow dirty', (_name, mutate) => {
    mutate();
    expect(store().isDirty).toBe(true);
  });

  it('is not set by selecting', () => {
    store().selectNode('a');
    store().selectEdge('e1');
    store().clearSelection();
    expect(store().isDirty).toBe(false);
  });
});

describe('selection', () => {
  it('is exclusive between nodes and edges', () => {
    store().selectNode('a');
    expect(store().selectedNodeId).toBe('a');

    store().selectEdge('e1');
    expect(store().selectedEdgeId).toBe('e1');
    expect(store().selectedNodeId).toBeNull();
  });

  it('bumps formEpoch so the properties form re-seeds', () => {
    const before = store().formEpoch;
    store().selectNode('a');
    expect(store().formEpoch).toBeGreaterThan(before);
  });
});
