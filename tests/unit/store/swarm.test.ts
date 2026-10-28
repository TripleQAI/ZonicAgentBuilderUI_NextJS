import { beforeEach, describe, expect, it } from 'vitest';

import {
  CONTAINER_HEADER_HEIGHT,
  CONTAINER_PADDING,
  containerSize,
  memberPosition,
} from '@/components/canvas/containerLayout';
import { repairContainers } from '@/lib/registry/containers';
import type { NodeSemantics } from '@/lib/registry/nodeSemantics';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { AgentDocument, AgentDraft, WorkflowNode } from '@/types/agent';
import type { NodeTypeDef } from '@/types/registry';

/**
 * Swarms: a container node whose members (agent and LLM nodes) are drawn inside
 * its frame. The members list on the swarm is what the runtime reads; `parentId`
 * only places a member on the canvas, so the store keeps the two in step.
 */

const SEMANTICS: NodeSemantics = {
  swarms: {
    swarm: { membersPath: 'config.members', entryPointPath: 'config.entryPoint', memberTypes: ['agent', 'llm'] },
  },
};

const type = (name: string, extra: Partial<NodeTypeDef> = {}): NodeTypeDef => ({
  type: name,
  label: name,
  icon: 'bi-circle',
  color: '#3b82f6',
  description: '',
  defaultNamePrefix: name,
  defaultConfig: {},
  handles: {},
  formSchema: {},
  outputSchema: {},
  validationSchema: {},
  sortOrder: 1,
  ...extra,
});

const node = (id: string, nodeType: string, extra: Partial<WorkflowNode> = {}): WorkflowNode => ({
  id,
  type: nodeType,
  name: id,
  config: {},
  position: { x: 0, y: 0 },
  ...extra,
});

const DOCUMENT: AgentDocument = {
  agenticWorkflowId: 'wf-1',
  name: 'team',
  displayName: 'Team',
  nodes: [
    node('s', 'swarm', {
      position: { x: 500, y: 100 },
      config: { members: ['a', 'w'], entryPoint: 'a' },
    }),
    // Stored relative to the swarm, as the builders save them.
    node('a', 'agent', { parentId: 's', position: { x: 24, y: 72 } }),
    node('w', 'llm', { parentId: 's', position: { x: 220, y: 72 } }),
    node('start', 'start'),
  ],
  edges: [{ id: 'e1', source: 'start', target: 's', sourceHandle: 'default' }],
};

const store = () => useWorkflowStore.getState();
const agent = () => store().currentAgent!;
const find = (id: string) => agent().nodes.find((n) => n.id === id);

beforeEach(() => {
  useWorkflowStore.setState({
    nodeRegistry: [
      type('swarm', { layout: { kind: 'container', minWidth: 420, minHeight: 150 } }),
      type('agent'),
      type('llm'),
      type('start'),
      type('tool'),
    ],
    nodeSemantics: SEMANTICS,
  });
  store().loadAgent(structuredClone(DOCUMENT));
});

describe('the frame layout', () => {
  it('keeps a member below the header and inside the padding', () => {
    expect(memberPosition({ x: 0, y: 0 })).toEqual({
      x: CONTAINER_PADDING,
      y: CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING,
    });
    expect(memberPosition({ x: 200, y: 300 })).toEqual({ x: 200, y: 300 });
  });

  it('sizes the frame to its members, never below the layout minimum', () => {
    const members = [node('a', 'agent', { position: { x: 24, y: 72 } })];
    const sizes = new Map([['a', { width: 180, height: 54 }]]);
    expect(containerSize({ minWidth: 420, minHeight: 150 }, members, sizes)).toEqual({ width: 420, height: 150 });
    const far = [node('a', 'agent', { position: { x: 600, y: 300 } })];
    expect(containerSize({ minWidth: 420, minHeight: 150 }, far, sizes)).toEqual({
      width: 600 + 180 + CONTAINER_PADDING,
      height: 300 + 54 + CONTAINER_PADDING,
    });
  });
});

describe('repairing a loaded swarm', () => {
  it('follows the members list: parentId is set or cleared, positions stay where they were drawn', () => {
    const draft: AgentDraft = structuredClone(DOCUMENT) as unknown as AgentDraft;
    const swarm = draft.nodes[0];
    swarm.config = { members: ['w', 'ghost'], entryPoint: 'a' };
    repairContainers(draft, SEMANTICS);
    const a = draft.nodes.find((n) => n.id === 'a')!;
    expect(a.parentId).toBeUndefined();
    expect(a.position).toEqual({ x: 524, y: 172 });
    expect(swarm.config).toEqual({ members: ['w'], entryPoint: '' });
  });
});

describe('editing a swarm', () => {
  it('a node dropped onto the swarm joins it below the header, and the first member is the entry point', () => {
    store().loadAgent({ ...structuredClone(DOCUMENT), nodes: [node('s', 'swarm', { position: { x: 500, y: 100 }, config: {} })] });
    const created = store().addNodeInto('agent', { x: 510, y: 110 }, 's')!;
    expect(created.parentId).toBe('s');
    expect(created.position).toEqual({ x: CONTAINER_PADDING, y: CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING });
    expect(find('s')!.config).toEqual({ members: [created.id], entryPoint: created.id });
  });

  it('a node type the swarm does not accept is added outside it', () => {
    const created = store().addNodeInto('tool', { x: 510, y: 110 }, 's')!;
    expect(created.parentId).toBeUndefined();
    expect(find('s')!.config.members).toEqual(['a', 'w']);
  });

  it('removing a member keeps the node, outside the swarm, where it was drawn', () => {
    store().removeMember('s', 'a');
    expect(find('a')!.parentId).toBeUndefined();
    expect(find('a')!.position).toEqual({ x: 524, y: 172 });
    expect(find('s')!.config).toEqual({ members: ['w'], entryPoint: '' });
  });

  it('deleting a member takes it out of the members list', () => {
    store().deleteNode('w');
    expect(find('w')).toBeUndefined();
    expect(find('s')!.config.members).toEqual(['a']);
  });

  it('deleting the swarm deletes its members and its edges', () => {
    store().deleteNode('s');
    expect(agent().nodes.map((n) => n.id)).toEqual(['start']);
    expect(agent().edges).toEqual([]);
  });

  it('a member moved on the canvas stays relative to the swarm', () => {
    store().moveNode('a', { x: 40, y: 90 });
    expect(find('a')!.position).toEqual({ x: 40, y: 90 });
    expect(find('a')!.positionAbsolute).toEqual({ x: 540, y: 190 });
  });
});
