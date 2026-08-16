/**
 * Typed fetch wrapper.
 *
 * The backend returns one error envelope for every failure
 * (`{error, code, traceId}`), so there is exactly one place that unpacks it.
 */

import { API_BASE, IS_DIRECT, endpoints } from '@/lib/api/endpoints';
import type {
  AgentDocument,
  AgentSummary,
  ImportResult,
  RelationshipMap,
  SaveResult,
  ValidationResult,
} from '@/types/agent';
import type { NodeTypeDef, ToolDef } from '@/types/registry';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = 'unknown',
    readonly traceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
        ...init?.headers,
      },
    });
  } catch {
    // A same-origin request failing here means the proxy target is down or
    // misconfigured; a direct one usually means CORS or the wrong host. Say
    // which, because the browser console will not.
    throw new ApiError(
      IS_DIRECT
        ? `Cannot reach the API at ${API_BASE}. It must be running and must allow ` +
          `this origin (${globalThis.location?.origin ?? 'unknown'}) in CORS_ORIGINS.`
        : 'Cannot reach the API. Requests are proxied by this server — check that ' +
          'the backend is running on API_BASE_URL (default http://localhost:8000).',
      0,
      'network_error',
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      body.error ?? `Request failed with ${response.status}`,
      response.status,
      body.code ?? 'unknown',
      body.traceId,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  listAgents: () =>
    request<{ agents: AgentSummary[] }>(endpoints.agents()).then((r) => r.agents),

  getAgent: (id: string) => request<AgentDocument>(endpoints.agent(id)),

  saveAgent: (id: string, document: AgentDocument) =>
    request<SaveResult>(endpoints.agent(id), {
      method: 'PUT',
      body: JSON.stringify(document),
    }),

  importPackage: (agentFile: File, subAgentsFile?: File | null) => {
    const form = new FormData();
    form.append('agent_file', agentFile);
    if (subAgentsFile) form.append('sub_agents_file', subAgentsFile);
    return request<ImportResult>(endpoints.importPackage(), {
      method: 'POST',
      body: form,
    });
  },

  importPackageJson: (agentData: AgentDocument, subAgentsData?: AgentDocument[] | null) =>
    request<ImportResult>(endpoints.importPackage(), {
      method: 'POST',
      body: JSON.stringify({ agent_data: agentData, sub_agents_data: subAgentsData ?? null }),
    }),

  getRelationships: (id: string) => request<RelationshipMap>(endpoints.relationships(id)),

  exportAgent: (id: string) => request<AgentDocument>(endpoints.exportAgent(id)),

  exportPackage: (id: string) =>
    request<{ agent: AgentDocument; sub_agents: AgentDocument[]; relationshipMap: unknown[] }>(
      endpoints.exportPackage(id),
    ),

  exportDebug: (id: string) =>
    request<Record<string, unknown>>(endpoints.exportDebug(id)),

  createSnapshot: (id: string, comment: string) =>
    request<{ snapshotId: string; createdAt: string }>(endpoints.snapshots(id), {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),

  embedAgent: (id: string) =>
    request<{ status: string; dimensions: number; textLength: number }>(endpoints.embed(id), {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  getNodeTypes: () =>
    request<{ nodeTypes: NodeTypeDef[] }>(endpoints.nodeTypes()).then((r) => r.nodeTypes),

  getTools: () => request<{ tools: ToolDef[] }>(endpoints.tools()).then((r) => r.tools),

  getOptionSets: () =>
    request<Record<string, { value: string; label: string }[]>>(endpoints.optionSets()),

  validateWorkflow: (document: AgentDocument) =>
    request<ValidationResult>(endpoints.validate(), {
      method: 'POST',
      body: JSON.stringify(document),
    }),
};
