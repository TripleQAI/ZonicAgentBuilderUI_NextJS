/**
 * Executor registry — one entry per node type (Strategy).
 *
 * Ported from the `_executors` object in runtime_mock.js, with the same output
 * strings so a trace from this build is comparable to one from the source.
 * Nothing here performs real work: no LLM, no HTTP, no script evaluation.
 */

import type { WorkflowNode } from '@/types/agent';

export interface ExecutionContext {
  system: Record<string, unknown>;
  flow: Record<string, unknown>;
  nodes: Record<string, { output: unknown; outputs: unknown }>;
  onHumanInput: (prompt: string, node: WorkflowNode) => Promise<string>;
  resolve: (value: string) => string;
  resolveDeep: (value: unknown) => unknown;
}

export interface ExecutorResult {
  output: Record<string, unknown>;
  log: string;
}

export type Executor = (
  node: WorkflowNode,
  context: ExecutionContext,
) => Promise<ExecutorResult> | ExecutorResult;

const config = (node: WorkflowNode) => (node.config ?? {}) as Record<string, unknown>;

export const EXECUTORS: Record<string, Executor> = {
  start: (node, ctx) => ({
    output: { result: ctx.flow.input ?? '' },
    log: 'START — workflow execution began',
  }),

  llm: (node, ctx) => {
    const cfg = config(node);
    const model = (cfg.model as string) ?? 'mock-model';
    const prompt = ctx.resolve(
      (cfg.systemPrompt as string) ?? (cfg.prompt as string) ?? '',
    );
    return {
      output: { result: `[MOCK LLM response from ${model}]`, prompt },
      log: `LLM — model: ${model}`,
    };
  },

  agent: (node) => {
    const model = (config(node).model as string) ?? 'mock-model';
    return {
      output: { result: `[MOCK Agent response via ${model}]` },
      log: `AGENT — model: ${model}`,
    };
  },

  external_agent: (node) => ({
    output: { result: '[MOCK external agent response]' },
    log: `EXTERNAL AGENT — ${String(config(node).endpoint ?? 'no endpoint')}`,
  }),

  rule: (node) => {
    const branches = (config(node).rules as { ruleId?: string; isDefault?: boolean }[]) ?? [];
    const matched = branches.find((b) => !b.isDefault) ?? branches[0];
    const ruleId = matched?.ruleId ?? 'default';
    return {
      output: { result: ruleId, _ruleId: ruleId },
      log: `RULE — matched branch: ${ruleId} (mock always picks first)`,
    };
  },

  script: (node) => {
    const code = (config(node).code as string) ?? '';
    return {
      output: { result: '[MOCK script output]', code: code.slice(0, 80) },
      log: `SCRIPT — ${code ? 'code present' : 'no code defined'}`,
    };
  },

  http_request: (node, ctx) => {
    const cfg = config(node);
    const url = ctx.resolve((cfg.url as string) ?? '');
    return {
      output: { result: '[MOCK HTTP response]', status: 200, url },
      log: `HTTP — ${String(cfg.method ?? 'GET')} ${url || '(no url)'}`,
    };
  },

  db_query: (node, ctx) => ({
    output: { result: '[MOCK rows]', rowCount: 0 },
    log: `DB QUERY — ${ctx.resolve(String(config(node).query ?? '')).slice(0, 60)}`,
  }),

  guardrail: () => ({
    output: { result: 'passed', passed: true },
    log: 'GUARDRAIL — mock always passes',
  }),

  workflow: (node) => {
    const childId = config(node).agenticWorkflowId as string | undefined;
    return {
      output: { result: `[MOCK sub-flow output for ${childId ?? 'unresolved child'}]` },
      log: childId
        ? `SUB FLOW — would invoke ${childId}`
        : 'SUB FLOW — no child workflow configured',
    };
  },

  variable: (node, ctx) => {
    const updates = (config(node).updates as { path?: string; value?: unknown }[]) ?? [];
    for (const update of updates) {
      if (update.path) ctx.flow[update.path] = ctx.resolveDeep(update.value);
    }
    return {
      output: { result: `${updates.length} variable(s) updated` },
      log: `VARIABLE — ${updates.length} update(s)`,
    };
  },

  output: (node, ctx) => {
    const mappings = (config(node).outputMapping as { target?: string; source?: unknown }[]) ?? [];
    const payload: Record<string, unknown> = {};
    for (const mapping of mappings) {
      if (mapping.target) payload[mapping.target] = ctx.resolveDeep(mapping.source);
    }
    return { output: { result: payload }, log: `OUTPUT — ${mappings.length} mapping(s)` };
  },

  approval: () => ({
    output: { result: 'approved', approved: true },
    log: 'APPROVAL — mock auto-approves',
  }),

  human_input: async (node, ctx) => {
    const prompt = ctx.resolve(
      (config(node).prompt as string) ?? 'Please provide input',
    );
    const answer = await ctx.onHumanInput(prompt, node);
    return { output: { result: answer }, log: `HUMAN INPUT — "${answer}"` };
  },

  tool: (node) => {
    const name = (config(node).toolName as string) ?? 'unnamed';
    return {
      output: { result: `[MOCK tool result from ${name}]` },
      log: `TOOL — ${name}`,
    };
  },

  view: (node) => ({
    output: { result: '[MOCK view rendered]' },
    log: `VIEW — ${String(config(node).viewId ?? 'no view')}`,
  }),

  swarm: (node) => {
    const members = Array.isArray(config(node).members) ? (config(node).members as string[]) : [];
    const entry = String(config(node).entryPoint || members[0] || 'none');
    return {
      output: { text: `[MOCK swarm answer from ${members.length} members]`, finalAgent: entry, nodeHistory: [entry] },
      log: `SWARM — ${members.length} members, starts at ${entry}`,
    };
  },

  note: () => ({
    output: { result: null },
    log: 'NOTE — not executed',
  }),

  default: (node) => ({
    output: { result: `[MOCK ${node.type} output]` },
    log: `${node.type.toUpperCase()} — generic mock`,
  }),
};
