import { describe, expect, it, vi } from 'vitest';

import { EXECUTORS } from '@/lib/runtime/executors';
import { resolveTokens, runMock } from '@/lib/runtime/mockEngine';
import { emptyAgent } from '@/lib/serialization/agentDocument';
import type { AgentDraft, WorkflowEdge, WorkflowNode } from '@/types/agent';

function node(id: string, type: string, config: Record<string, unknown> = {}): WorkflowNode {
  return { id, type, name: id, config, position: { x: 0, y: 0 } };
}

function edge(source: string, target: string, sourceHandle?: string): WorkflowEdge {
  return { id: `${source}->${target}`, source, target, sourceHandle: sourceHandle ?? null };
}

function agentWith(nodes: WorkflowNode[], edges: WorkflowEdge[]): AgentDraft {
  return { ...emptyAgent('test'), nodes, edges };
}

const noHumanInput = async () => '';

describe('token resolution', () => {
  const context = {
    system: { userQuery: 'hello' },
    nodes: { LLM_1: { output: { result: 'answer' } } },
  } as never;

  it('substitutes a known dot-path', () => {
    expect(resolveTokens('Q: {{system.userQuery}}', context)).toBe('Q: hello');
  });

  it('leaves an unknown token untouched, as the source did', () => {
    expect(resolveTokens('{{nope.missing}}', context)).toBe('{{nope.missing}}');
  });

  it('resolves nested node outputs', () => {
    expect(resolveTokens('{{nodes.LLM_1.output.result}}', context)).toBe('answer');
  });
});

describe('mock run', () => {
  it('walks from start to the end of the graph', async () => {
    const agent = agentWith(
      [node('s', 'start'), node('l', 'llm', { model: 'm' }), node('o', 'output')],
      [edge('s', 'l'), edge('l', 'o')],
    );
    const trace = await runMock(agent, { userQuery: 'hi', onHumanInput: noHumanInput });
    expect(trace.map((t) => t.nodeId)).toEqual(['s', 'l', 'o']);
    expect(trace.every((t) => t.status === 'ok')).toBe(true);
  });

  it('follows the branch a rule node selects', async () => {
    const agent = agentWith(
      [
        node('s', 'start'),
        node('r', 'rule', { rules: [{ ruleId: 'yes' }, { ruleId: 'no', isDefault: true }] }),
        node('a', 'note'),
        node('b', 'note'),
      ],
      [edge('s', 'r'), edge('r', 'a', 'yes'), edge('r', 'b', 'no')],
    );
    const trace = await runMock(agent, { userQuery: '', onHumanInput: noHumanInput });
    expect(trace.map((t) => t.nodeId)).toEqual(['s', 'r', 'a']);
  });

  it('suspends on a human input node and resumes with the answer', async () => {
    const onHumanInput = vi.fn().mockResolvedValue('42');
    const agent = agentWith(
      [node('s', 'start'), node('h', 'human_input', { prompt: 'How many?' })],
      [edge('s', 'h')],
    );
    const trace = await runMock(agent, { userQuery: '', onHumanInput });
    expect(onHumanInput).toHaveBeenCalledWith('How many?', expect.objectContaining({ id: 'h' }));
    expect(trace[1].output).toEqual({ result: '42' });
  });

  it('stops instead of hanging on a cycle', async () => {
    const agent = agentWith(
      [node('s', 'start'), node('a', 'note'), node('b', 'note')],
      [edge('s', 'a'), edge('a', 'b'), edge('b', 'a')],
    );
    const trace = await runMock(agent, {
      userQuery: '',
      onHumanInput: noHumanInput,
      maxSteps: 50,
    });
    expect(trace.length).toBeLessThan(50);
    expect(trace.at(-1)?.status).toBe('skipped');
  });

  it('makes no network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const agent = agentWith(
      [node('s', 'start'), node('h', 'http_request', { url: 'https://example.com' })],
      [edge('s', 'h')],
    );
    await runMock(agent, { userQuery: '', onHumanInput: noHumanInput });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('executor registry', () => {
  const REQUIRED = [
    'start', 'llm', 'agent', 'external_agent', 'rule', 'script', 'http_request',
    'db_query', 'guardrail', 'workflow', 'variable', 'output', 'approval',
    'human_input', 'tool', 'view', 'note',
  ];

  it('covers every node type in the registry', () => {
    for (const type of REQUIRED) {
      expect(EXECUTORS[type], `missing executor for ${type}`).toBeTypeOf('function');
    }
  });

  it('falls back for an unknown node type', () => {
    expect(EXECUTORS.default).toBeTypeOf('function');
  });
});
