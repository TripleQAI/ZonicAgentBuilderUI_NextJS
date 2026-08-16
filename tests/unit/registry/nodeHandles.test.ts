import { describe, expect, it } from 'vitest';

import { HANDOFF_PREFIX, deriveHandles } from '@/lib/registry/nodeHandles';
import type { NodeSemantics } from '@/lib/registry/nodeSemantics';
import type { WorkflowEdge, WorkflowNode } from '@/types/agent';
import type { NodeTypeDef } from '@/types/registry';

/**
 * React Flow silently drops any edge whose handle id is not rendered on the
 * node — no error, the connection just disappears. Every case below is taken
 * from the real `fsh-energy-agent` workflow, where six of twenty-three edges
 * vanished because the handles came from the static registry alone.
 */

const SEMANTICS: NodeSemantics = {
  childReference: { workflow: 'config.agenticWorkflowId' },
  handoffTargets: { agent: 'config.handoffTarget' },
  branches: { rule: { path: 'config.rules', idField: 'ruleId' } },
};

function def(type: string, sources: string[], targets: string[] = ['default']): NodeTypeDef {
  return {
    type,
    label: type,
    icon: '',
    color: '',
    description: '',
    defaultNamePrefix: type,
    defaultConfig: {},
    handles: {
      sources: sources.map((id) => ({ id, position: 'bottom' as const })),
      targets: targets.map((id) => ({ id, position: 'top' as const })),
    },
    formSchema: {},
    outputSchema: {},
    validationSchema: {},
    sortOrder: 0,
  };
}

function node(id: string, type: string, config: Record<string, unknown> = {}): WorkflowNode {
  return { id, type, name: id, config, position: { x: 0, y: 0 } };
}

describe('ordinary nodes', () => {
  it('use the handles the registry declares', () => {
    const handles = deriveHandles(node('n1', 'llm'), def('llm', ['default']), SEMANTICS);
    expect(handles.sources.map((h) => h.id)).toEqual(['default']);
    expect(handles.targets.map((h) => h.id)).toEqual(['default']);
  });

  it('survive a node type the registry does not know', () => {
    const handles = deriveHandles(node('n1', 'mystery'), undefined, SEMANTICS);
    expect(handles).toEqual({ targets: [], sources: [] });
  });
});

describe('rule nodes', () => {
  // The registry declares only the two default branches.
  const ruleDef = def('rule', ['r_default', 'r_else']);

  it('render one output per CONFIGURED branch, not per declared one', () => {
    const rule = node('rule_1', 'rule', {
      rules: [
        { ruleId: 'r_default', label: 'True' },
        { ruleId: 'r_elgn8m', label: 'Historical' },
        { ruleId: 'r_vrqa4o', label: 'Reference' },
        { ruleId: 'r_cwv5sg', label: 'Direct' },
        { ruleId: 'r_else', label: 'Else' },
      ],
    });
    const handles = deriveHandles(rule, ruleDef, SEMANTICS);

    expect(handles.sources.map((h) => h.id)).toEqual([
      'r_default',
      'r_elgn8m',
      'r_vrqa4o',
      'r_cwv5sg',
      'r_else',
    ]);
    expect(handles.sources.every((h) => h.kind === 'branch')).toBe(true);
    expect(handles.sources[1].label).toBe('Historical');
  });

  it('fall back to the declared branches when none are configured', () => {
    const handles = deriveHandles(node('r', 'rule', { rules: [] }), ruleDef, SEMANTICS);
    expect(handles.sources.map((h) => h.id)).toEqual(['r_default', 'r_else']);
  });

  it('ignore malformed branch entries', () => {
    const rule = node('r', 'rule', { rules: [{ label: 'no id' }, null, { ruleId: 'ok' }] });
    expect(deriveHandles(rule, ruleDef, SEMANTICS).sources.map((h) => h.id)).toEqual(['ok']);
  });
});

describe('agent nodes', () => {
  const agentDef = def('agent', ['default']);

  it('add one output per handoff target, keeping the default', () => {
    const agent = node('agent_1', 'agent', {
      handoffTarget: ['llm_a', 'llm_b', 'llm_c'],
    });
    const handles = deriveHandles(agent, agentDef, SEMANTICS, {
      llm_a: 'keywords-extraction',
      llm_b: 'direct-answer',
    });

    expect(handles.sources.map((h) => h.id)).toEqual([
      'default',
      `${HANDOFF_PREFIX}llm_a`,
      `${HANDOFF_PREFIX}llm_b`,
      `${HANDOFF_PREFIX}llm_c`,
    ]);
    // Labelled with the target's name, falling back to its id.
    expect(handles.sources[1].label).toBe('keywords-extraction');
    expect(handles.sources[3].label).toBe('llm_c');
  });

  it('accepts a single target given as a string', () => {
    const agent = node('a', 'agent', { handoffTarget: 'llm_a' });
    expect(deriveHandles(agent, agentDef, SEMANTICS).sources.map((h) => h.id)).toEqual([
      'default',
      `${HANDOFF_PREFIX}llm_a`,
    ]);
  });
});

describe('every stored edge finds a handle', () => {
  /** The shape that was losing 6 of 23 edges. */
  const nodes: WorkflowNode[] = [
    node('start_1', 'start'),
    node('agent_1', 'agent', { handoffTarget: ['llm_a', 'llm_b', 'llm_c'] }),
    node('llm_a', 'llm'),
    node('llm_b', 'llm'),
    node('llm_c', 'llm'),
    node('rule_1', 'rule', {
      rules: [{ ruleId: 'r_default' }, { ruleId: 'r_elgn8m' }, { ruleId: 'r_else' }],
    }),
    node('llm_d', 'llm'),
  ];

  const definitions: Record<string, NodeTypeDef> = {
    start: def('start', ['default'], []),
    agent: def('agent', ['default']),
    llm: def('llm', ['default']),
    rule: def('rule', ['r_default', 'r_else']),
  };

  const edges: WorkflowEdge[] = [
    { id: 'e1', source: 'start_1', target: 'agent_1', sourceHandle: 'default' },
    { id: 'e2', source: 'agent_1', target: 'llm_a', sourceHandle: 'handoff-llm_a' },
    { id: 'e3', source: 'agent_1', target: 'llm_b', sourceHandle: 'handoff-llm_b' },
    { id: 'e4', source: 'agent_1', target: 'llm_c', sourceHandle: 'handoff-llm_c' },
    { id: 'e5', source: 'rule_1', target: 'llm_d', sourceHandle: 'r_default' },
    { id: 'e6', source: 'rule_1', target: 'llm_d', sourceHandle: 'r_elgn8m' },
    { id: 'e7', source: 'rule_1', target: 'llm_d', sourceHandle: 'r_else' },
    // A null handle means "the node's only output".
    { id: 'e8', source: 'llm_a', target: 'rule_1', sourceHandle: null },
  ];

  it('leaves no edge without a matching source handle', () => {
    const byId = Object.fromEntries(
      nodes.map((n) => [
        n.id,
        deriveHandles(n, definitions[n.type], SEMANTICS, {}),
      ]),
    );

    const orphaned = edges.filter((edge) => {
      const ids = byId[edge.source].sources.map((h) => h.id);
      return edge.sourceHandle ? !ids.includes(edge.sourceHandle) : ids.length === 0;
    });

    expect(orphaned.map((e) => `${e.id}: ${e.source} -${e.sourceHandle}->`)).toEqual([]);
  });

  it('leaves no edge without a matching target handle', () => {
    const byId = Object.fromEntries(
      nodes.map((n) => [n.id, deriveHandles(n, definitions[n.type], SEMANTICS, {})]),
    );
    const orphaned = edges.filter((edge) => byId[edge.target].targets.length === 0);
    expect(orphaned.map((e) => e.id)).toEqual([]);
  });
});

describe('working without /api/v1/node-semantics', () => {
  /**
   * The semantics endpoint is an optimisation, not a dependency. An older
   * backend that does not serve it must still draw every handle, or handoff
   * edges vanish — which is exactly what happened before this was fixed.
   */
  const NONE: NodeSemantics = {};

  const agentDef: NodeTypeDef = {
    ...def('agent', ['default']),
    // The registry says where the handoff list is: the field its editor binds to.
    formSchema: {
      sections: [
        {
          title: 'Handoff',
          fields: [{ key: 'config.handoffTarget', type: 'node_multiselect' }],
        },
      ],
    },
  };

  it('finds the handoff list from the registry alone', () => {
    const agent = node('a', 'agent', { handoffTarget: ['llm_a', 'llm_b'] });
    const handles = deriveHandles(agent, agentDef, NONE);

    expect(handles.sources.map((h) => h.id)).toEqual([
      'default',
      `${HANDOFF_PREFIX}llm_a`,
      `${HANDOFF_PREFIX}llm_b`,
    ]);
  });

  it('still renders a handle for any handle a stored edge names', () => {
    // No semantics, and a rule whose branches the registry does not declare.
    const rule = node('r', 'rule', { rules: [] });
    const edges = [
      { id: 'e1', source: 'r', target: 'x', sourceHandle: 'r_unknown' },
      { id: 'e2', source: 'y', target: 'r', targetHandle: 'in_2' },
    ];
    const handles = deriveHandles(rule, def('rule', ['r_default']), NONE, {}, edges);

    expect(handles.sources.map((h) => h.id)).toContain('r_unknown');
    expect(handles.targets.map((h) => h.id)).toContain('in_2');
  });

  it('does not duplicate a handle an edge and the config both imply', () => {
    const agent = node('a', 'agent', { handoffTarget: ['llm_a'] });
    const edges = [
      { id: 'e1', source: 'a', target: 'llm_a', sourceHandle: `${HANDOFF_PREFIX}llm_a` },
    ];
    const ids = deriveHandles(agent, agentDef, NONE, {}, edges).sources.map((h) => h.id);

    expect(ids.filter((id) => id === `${HANDOFF_PREFIX}llm_a`)).toHaveLength(1);
  });
});
