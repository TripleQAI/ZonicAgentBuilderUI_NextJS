import { describe, expect, it } from 'vitest';

import { emptyAgent, fromAgentJson, toAgentJson } from './agentDocument';

/**
 * The raw_json overlay is the contract most likely to break silently, so it
 * gets the most direct tests (MIGRATION_PLAN.md §10.6, R2).
 */
describe('agent document round trip', () => {
  const document = {
    agenticWorkflowId: '11111111-2222-3333-4444-555555555555',
    name: 'wf',
    displayName: 'Workflow',
    nodes: [{ id: 'n1', type: 'start', name: 'Start', config: {} }],
    edges: [{ id: 'e1', source: 'n1', target: 'n1' }],
    // Keys no model knows about — these are the ones that must survive.
    originalBpc: 'BPC-1',
    freezeRelease: true,
    createdBy: 'someone@example.com',
    nested: { deep: { value: 42 } },
  };

  it('preserves unknown keys through a round trip', () => {
    const result = toAgentJson(fromAgentJson(document));
    expect(result.originalBpc).toBe('BPC-1');
    expect(result.freezeRelease).toBe(true);
    expect(result.createdBy).toBe('someone@example.com');
    expect(result.nested).toEqual({ deep: { value: 42 } });
  });

  it('overlays edited first-class fields on top of the original document', () => {
    const draft = fromAgentJson(document);
    draft.displayName = 'Renamed';
    draft.nodes = [{ id: 'n2', type: 'note', name: 'Note', config: {}, position: { x: 0, y: 0 } }];

    const result = toAgentJson(draft);
    expect(result.displayName).toBe('Renamed');
    expect(result.nodes).toHaveLength(1);
    expect((result.nodes as { id: string }[])[0].id).toBe('n2');
    // ...and the unknown keys are still there.
    expect(result.originalBpc).toBe('BPC-1');
  });

  it('strips the React Flow data key from stored nodes on load', () => {
    const draft = fromAgentJson({
      ...document,
      nodes: [{ id: 'n1', type: 'start', name: 'S', config: {}, data: { label: 'stale' } }],
    });
    expect(draft.nodes[0]).not.toHaveProperty('data');
  });

  it('does not mutate the input document', () => {
    const input = structuredClone(document);
    const draft = fromAgentJson(input);
    draft.nodes.push({
      id: 'x',
      type: 'note',
      name: 'X',
      config: {},
      position: { x: 0, y: 0 },
    });
    expect(input.nodes).toHaveLength(1);
  });

  it('produces a usable empty agent', () => {
    const agent = emptyAgent('fixed-id');
    expect(agent.agenticWorkflowId).toBe('fixed-id');
    expect(agent.nodes).toEqual([]);
    expect(toAgentJson(agent).agenticWorkflowId).toBe('fixed-id');
  });
});
