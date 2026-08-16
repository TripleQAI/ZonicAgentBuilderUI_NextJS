import { beforeEach, describe, expect, it } from 'vitest';

import { HANDOFF_PREFIX } from '@/lib/registry/nodeHandles';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { AgentDocument } from '@/types/agent';

/**
 * A handoff is two things kept in step: an entry in `config.handoffTarget` and
 * a wire on the canvas. Either half on its own is a bug — a target with no wire
 * shows an unconnected node, a wire with no target loses the handle it attaches
 * to and disappears on reload.
 */

const AGENT_ID = 'agent_1';
/** The dot-path the registry's handoff editor is bound to. */
const PATH = 'config.handoffTarget';

const DOCUMENT: AgentDocument = {
  agenticWorkflowId: 'wf-1',
  name: 'demo',
  displayName: 'Demo',
  nodes: [
    { id: 'start_1', type: 'start', name: 'Start_1', config: {}, position: { x: 0, y: 0 } },
    { id: AGENT_ID, type: 'agent', name: 'supervisor', config: {}, position: { x: 0, y: 0 } },
    { id: 'sub_a', type: 'workflow', name: 'energy-agent', config: {}, position: { x: 0, y: 0 } },
    { id: 'sub_b', type: 'workflow', name: 'risk-energy', config: {}, position: { x: 0, y: 0 } },
  ],
  edges: [],
};

const SEMANTICS = {
  handoffTargets: { agent: 'config.handoffTarget' },
  branches: { rule: { path: 'config.rules', idField: 'ruleId' } },
};

function store() {
  return useWorkflowStore.getState();
}

function agentNode() {
  return store().currentAgent!.nodes.find((n) => n.id === AGENT_ID)!;
}

function targets(): string[] {
  return ((agentNode().config as Record<string, unknown>).handoffTarget ?? []) as string[];
}

function handoffEdges() {
  return store().currentAgent!.edges.filter((e) => e.data?.handoff === true);
}

/** Only the parts of the registry these tests depend on. */
const REGISTRY = [
  {
    type: 'agent',
    label: 'Agent',
    icon: '',
    color: '',
    description: '',
    defaultNamePrefix: 'Agent',
    defaultConfig: {},
    handles: {},
    // The handoff editor, bound to the path above.
    formSchema: {
      sections: [
        { title: 'Handoff', fields: [{ key: PATH, type: 'node_multiselect' }] },
      ],
    },
    outputSchema: {},
    validationSchema: {},
    sortOrder: 0,
  },
];

beforeEach(() => {
  useWorkflowStore.setState({ nodeSemantics: SEMANTICS, nodeRegistry: REGISTRY });
  store().loadAgent(structuredClone(DOCUMENT));
});

describe('adding a handoff target', () => {
  it('creates the wire at the same time', () => {
    store().setHandoffTargets(AGENT_ID, PATH, ['sub_a']);

    expect(targets()).toEqual(['sub_a']);
    const edges = handoffEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(AGENT_ID);
    expect(edges[0].target).toBe('sub_a');
    // On that target's own handle, which is what the Agent node renders.
    expect(edges[0].sourceHandle).toBe(`${HANDOFF_PREFIX}sub_a`);
  });

  it('adds one wire per target', () => {
    store().setHandoffTargets(AGENT_ID, PATH, ['sub_a', 'sub_b']);
    expect(handoffEdges().map((e) => e.target)).toEqual(['sub_a', 'sub_b']);
  });

  it('marks the workflow dirty', () => {
    expect(store().isDirty).toBe(false);
    store().setHandoffTargets(AGENT_ID, PATH, ['sub_a']);
    expect(store().isDirty).toBe(true);
  });

  it('re-uses an existing wire rather than drawing a second one', () => {
    // The user already drew agent -> sub_a by hand.
    store().addEdge(AGENT_ID, 'default', 'sub_a', null);
    store().setHandoffTargets(AGENT_ID, PATH, ['sub_a']);

    const between = store().currentAgent!.edges.filter(
      (e) => e.source === AGENT_ID && e.target === 'sub_a',
    );
    expect(between).toHaveLength(1);
    expect(between[0].data?.handoff).toBe(true);
    expect(between[0].sourceHandle).toBe(`${HANDOFF_PREFIX}sub_a`);
  });
});

describe('removing a handoff target', () => {
  it('deletes its wire', () => {
    store().setHandoffTargets(AGENT_ID, PATH, ['sub_a', 'sub_b']);
    store().setHandoffTargets(AGENT_ID, PATH, ['sub_b']);

    expect(targets()).toEqual(['sub_b']);
    expect(handoffEdges().map((e) => e.target)).toEqual(['sub_b']);
  });

  it('leaves ordinary wires from the same node alone', () => {
    store().addEdge(AGENT_ID, 'default', 'start_1', null);
    store().setHandoffTargets(AGENT_ID, PATH, ['sub_a']);
    store().setHandoffTargets(AGENT_ID, PATH, []);

    expect(targets()).toEqual([]);
    expect(handoffEdges()).toHaveLength(0);
    // The hand-drawn wire survives.
    expect(
      store().currentAgent!.edges.filter((e) => e.target === 'start_1'),
    ).toHaveLength(1);
  });
});

describe('deleting the wire on the canvas', () => {
  it('removes the target from the config', () => {
    store().setHandoffTargets(AGENT_ID, PATH, ['sub_a', 'sub_b']);
    const edge = handoffEdges().find((e) => e.target === 'sub_a')!;

    store().deleteEdge(edge.id);

    expect(targets()).toEqual(['sub_b']);
    expect(handoffEdges().map((e) => e.target)).toEqual(['sub_b']);
  });

  it('does not touch the config for a non-handoff wire', () => {
    store().setHandoffTargets(AGENT_ID, PATH, ['sub_a']);
    const plain = store().addEdge('start_1', 'default', AGENT_ID, null)!;

    store().deleteEdge(plain.id);

    expect(targets()).toEqual(['sub_a']);
    expect(handoffEdges()).toHaveLength(1);
  });
});

describe('what gets saved', () => {
  it('keeps config and edges consistent for the server', () => {
    store().setHandoffTargets(AGENT_ID, PATH, ['sub_a', 'sub_b']);

    // The backend derives one relationship per handoff target, so the two must
    // describe the same thing.
    const stored = targets();
    const wired = handoffEdges().map((e) => e.target);
    expect(wired).toEqual(stored);
    for (const edge of handoffEdges()) {
      expect(edge.sourceHandle).toBe(`${HANDOFF_PREFIX}${edge.target}`);
    }
  });

  it('does nothing without a path', () => {
    store().setHandoffTargets(AGENT_ID, '', ['sub_b']);
    expect(store().currentAgent!.edges).toHaveLength(0);
  });
});
