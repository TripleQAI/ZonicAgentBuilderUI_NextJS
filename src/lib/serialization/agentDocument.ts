/**
 * The raw_json overlay contract, client side.
 *
 * This is the rule the plan flags as the top drift risk (§10.6): the editor
 * works on first-class fields, but the document that goes back to the server
 * must start from the original JSON so unknown keys — originalBpc,
 * freezeRelease, createdBy and anything else a future producer adds — survive
 * the round trip. Both directions live here, and nowhere else.
 */

import type { AgentDocument, AgentDraft, WorkflowEdge, WorkflowNode } from '@/types/agent';

/** Server document -> editor draft. */
export function fromAgentJson(document: AgentDocument): AgentDraft {
  const raw = structuredClone(document);
  const nodes = (structuredClone(document.nodes ?? []) as WorkflowNode[]).map((node) => {
    // The source stripped `data` on load; React Flow owns that key.
    // React Flow owns `data`; a stale copy from a previous session must not
    // survive into the store (the source deleted it on load too).
    const rest = { ...(node as WorkflowNode & { data?: unknown }) };
    delete rest.data;
    return rest as WorkflowNode;
  });

  return {
    agenticWorkflowId: String(document.agenticWorkflowId ?? ''),
    name: String(document.name ?? ''),
    displayName: String(document.displayName ?? ''),
    description: String(document.description ?? ''),
    bpc: String(document.bpc ?? ''),
    editAs: String(document.editAs ?? ''),
    invocationType: String(document.invocationType ?? ''),
    isDisabled: Boolean(document.isDisabled),
    isAvailableForMigration: Boolean(document.isAvailableForMigration),
    enableForAutoInvoke: Boolean(document.enableForAutoInvoke),
    includeThoughts: Boolean(document.includeThoughts),
    nodes,
    edges: structuredClone(document.edges ?? []) as WorkflowEdge[],
    variables: (document.variables ?? {}) as Record<string, unknown>,
    interface: (document.interface ?? {}) as Record<string, unknown>,
    skills: (document.skills ?? []) as unknown[],
    publishChannels: (document.publishChannels ?? []) as unknown[],
    security: (document.security ?? {}) as Record<string, unknown>,
    rawJson: raw,
    semanticSearchEnabled: Boolean(document.semanticSearchEnabled),
    semanticDomain: String(document.semanticDomain ?? ''),
    semanticKeywords: String(document.semanticKeywords ?? ''),
    semanticUseCases: String(document.semanticUseCases ?? ''),
    systemParams: Array.isArray(document.systemParams) ? document.systemParams : [],
  };
}

/** Editor draft -> server document. Starts from rawJson, overlays the edits. */
export function toAgentJson(draft: AgentDraft): AgentDocument {
  const out: AgentDocument = structuredClone(draft.rawJson ?? {});

  out.agenticWorkflowId = draft.agenticWorkflowId;
  out.nodes = structuredClone(draft.nodes);
  out.edges = structuredClone(draft.edges);
  out.variables = draft.variables;
  out.interface = draft.interface;
  out.skills = draft.skills;
  out.publishChannels = draft.publishChannels;
  out.security = draft.security;

  out.name = draft.name;
  out.displayName = draft.displayName;
  out.description = draft.description;
  out.bpc = draft.bpc;
  out.editAs = draft.editAs;
  out.invocationType = draft.invocationType;
  out.isDisabled = draft.isDisabled;
  out.isAvailableForMigration = draft.isAvailableForMigration;
  out.enableForAutoInvoke = draft.enableForAutoInvoke;
  out.includeThoughts = draft.includeThoughts;
  out.semanticSearchEnabled = draft.semanticSearchEnabled;
  out.semanticDomain = draft.semanticDomain;
  out.semanticKeywords = draft.semanticKeywords;
  out.semanticUseCases = draft.semanticUseCases;
  out.systemParams = draft.systemParams ?? [];

  return out;
}

/** A fresh, empty workflow — the "New Workflow" action. */
export function emptyAgent(id: string = crypto.randomUUID()): AgentDraft {
  return {
    agenticWorkflowId: id,
    name: 'new-workflow',
    displayName: 'New Workflow',
    description: '',
    bpc: '',
    editAs: '',
    invocationType: '',
    isDisabled: false,
    isAvailableForMigration: false,
    enableForAutoInvoke: false,
    includeThoughts: false,
    nodes: [],
    edges: [],
    variables: {},
    interface: {},
    skills: [],
    publishChannels: [],
    security: {},
    rawJson: {},
    semanticSearchEnabled: false,
    semanticDomain: '',
    semanticKeywords: '',
    semanticUseCases: '',
    systemParams: [],
  };
}
