/**
 * Client-side mock execution. Ported from runtime_mock.js.
 *
 * Walks the graph from the `start` node, resolves `{{dot.path}}` tokens against
 * the execution context, and dispatches to an executor registry keyed by node
 * type. No LLM, tool or HTTP call is ever made — every executor returns a
 * placeholder, exactly as the source did.
 */

import { EXECUTORS, type ExecutionContext, type ExecutorResult } from '@/lib/runtime/executors';
import type { AgentDraft, WorkflowNode } from '@/types/agent';

export interface TraceEntry {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'ok' | 'error' | 'skipped';
  log: string;
  output?: unknown;
  error?: string;
}

/** How often one node may execute before the run is treated as looping. */
const MAX_VISITS_PER_NODE = 10;

export interface MockRunOptions {
  userQuery: string;
  /** Resolves when the user answers a Human Input node. */
  onHumanInput: (prompt: string, node: WorkflowNode) => Promise<string>;
  maxSteps?: number;
}

/** Replace every `{{a.b.c}}` token with its value, leaving unknowns intact. */
export function resolveTokens(value: string, context: ExecutionContext): string {
  return value.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    let cursor: unknown = context;
    for (const part of path.trim().split('.')) {
      if (cursor == null || typeof cursor !== 'object') return `{{${path}}}`;
      cursor = (cursor as Record<string, unknown>)[part];
    }
    return cursor != null ? String(cursor) : `{{${path}}}`;
  });
}

export function resolveDeep(value: unknown, context: ExecutionContext): unknown {
  if (typeof value === 'string') return resolveTokens(value, context);
  if (Array.isArray(value)) return value.map((item) => resolveDeep(item, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        resolveDeep(v, context),
      ]),
    );
  }
  return value;
}

export async function runMock(
  agent: AgentDraft,
  options: MockRunOptions,
): Promise<TraceEntry[]> {
  const trace: TraceEntry[] = [];
  const context: ExecutionContext = {
    system: { userQuery: options.userQuery, now: new Date().toISOString() },
    flow: { input: options.userQuery, ...(agent.variables as Record<string, unknown>) },
    nodes: {},
    onHumanInput: options.onHumanInput,
    resolve: (value) => resolveTokens(value, context),
    resolveDeep: (value) => resolveDeep(value, context),
  };

  const start =
    agent.nodes.find((n) => n.type === 'start') ?? agent.nodes[0] ?? null;
  if (!start) return trace;

  const maxSteps = options.maxSteps ?? 200;
  const visits = new Map<string, number>();
  let current: WorkflowNode | null = start;
  let steps = 0;

  while (current && steps < maxSteps) {
    steps += 1;

    // A cycle is legal in a workflow — a retry loop, for instance — but the
    // mock always takes the same branch, so it would never terminate. Cap how
    // often any one node may run.
    const visitCount = (visits.get(current.id) ?? 0) + 1;
    visits.set(current.id, visitCount);
    if (visitCount > MAX_VISITS_PER_NODE) {
      trace.push({
        nodeId: current.id,
        nodeName: current.name,
        nodeType: current.type,
        status: 'skipped',
        log: `Loop guard: '${current.name}' reached ${MAX_VISITS_PER_NODE} visits, stopping`,
      });
      break;
    }

    const executor = EXECUTORS[current.type] ?? EXECUTORS.default;
    let result: ExecutorResult;
    try {
      result = await executor(current, context);
    } catch (cause) {
      trace.push({
        nodeId: current.id,
        nodeName: current.name,
        nodeType: current.type,
        status: 'error',
        log: 'Executor threw',
        error: (cause as Error).message,
      });
      break;
    }

    context.nodes[current.name] = { output: result.output, outputs: result.output };
    trace.push({
      nodeId: current.id,
      nodeName: current.name,
      nodeType: current.type,
      status: 'ok',
      log: result.log,
      output: result.output,
    });

    current = nextNode(agent, current, result);
  }

  return trace;
}

/** Follow the outgoing edge, honouring a rule node's chosen branch. */
function nextNode(
  agent: AgentDraft,
  from: WorkflowNode,
  result: ExecutorResult,
): WorkflowNode | null {
  const branch = (result.output as { _ruleId?: string } | undefined)?._ruleId;
  const candidates = agent.edges.filter((edge) => edge.source === from.id);
  const chosen =
    (branch && candidates.find((edge) => edge.sourceHandle === branch)) ??
    candidates.find((edge) => !edge.sourceHandle || edge.sourceHandle === 'default') ??
    candidates[0];
  if (!chosen) return null;
  return agent.nodes.find((node) => node.id === chosen.target) ?? null;
}
