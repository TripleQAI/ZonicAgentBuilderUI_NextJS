/**
 * Every API path, in one place.
 *
 * The plan calls for these to be generated from the backend's OpenAPI document
 * (`npm run api:gen`). Until that runs against a live server, they are declared
 * here — still one place, still the only place a URL string appears.
 */

/**
 * Empty by default, which makes every URL below relative — a same-origin
 * request that `next.config.ts` rewrites to the API server. No cross-origin
 * request, so no CORS preflight and nothing for the backend to allow-list.
 *
 * Set NEXT_PUBLIC_API_BASE_URL to call the API directly instead. That is a
 * cross-origin request, so the API must return `Access-Control-Allow-Origin`
 * for this app's exact origin — add it to the backend's CORS_ORIGINS.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

/** True when requests go straight to the API rather than through the proxy. */
export const IS_DIRECT = API_BASE !== '';

const V1 = `${API_BASE}/api/v1`;

export const endpoints = {
  agents: () => `${V1}/agents`,
  agent: (id: string) => `${V1}/agents/${id}`,
  importPackage: () => `${V1}/agents/import-package`,
  relationships: (id: string) => `${V1}/agents/${id}/relationships`,
  exportAgent: (id: string) => `${V1}/agents/${id}/export`,
  exportPackage: (id: string) => `${V1}/agents/${id}/export-package`,
  exportDebug: (id: string) => `${V1}/agents/${id}/export-debug`,
  snapshots: (id: string) => `${V1}/agents/${id}/snapshots`,
  embed: (id: string) => `${V1}/agents/${id}/embed`,
  nodeTypes: () => `${V1}/node-types`,
  tools: () => `${V1}/tools`,
  optionSets: () => `${V1}/option-sets`,
  nodeSemantics: () => `${V1}/node-semantics`,
  validate: () => `${V1}/workflows/validate`,
  runMock: () => `${V1}/workflows/run-mock`,
  health: () => `${API_BASE}/health`,
  ready: () => `${API_BASE}/health/ready`,
} as const;
