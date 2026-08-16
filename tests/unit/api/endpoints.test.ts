import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The API base decides whether the browser makes a same-origin request (proxied
 * by next.config.ts, no CORS) or a cross-origin one (needs the backend to
 * allow-list this exact origin). Getting it wrong shows up only as a console
 * full of preflight failures, so both modes are pinned here.
 *
 * `endpoints.ts` reads process.env at module load, so each test re-imports it.
 */

const ORIGINAL = process.env.NEXT_PUBLIC_API_BASE_URL;

async function loadEndpoints(base: string | undefined) {
  vi.resetModules();
  if (base === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = base;
  return import('@/lib/api/endpoints');
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = ORIGINAL;
});

describe('proxied mode (the default)', () => {
  it('produces relative URLs, so requests are same-origin', async () => {
    const { endpoints, API_BASE, IS_DIRECT } = await loadEndpoints(undefined);

    expect(API_BASE).toBe('');
    expect(IS_DIRECT).toBe(false);
    expect(endpoints.agents()).toBe('/api/v1/agents');
    expect(endpoints.nodeTypes()).toBe('/api/v1/node-types');
    expect(endpoints.optionSets()).toBe('/api/v1/option-sets');
    expect(endpoints.health()).toBe('/health');
  });

  it('never emits an absolute URL', async () => {
    const { endpoints } = await loadEndpoints(undefined);
    for (const [name, build] of Object.entries(endpoints)) {
      const url = (build as (id: string) => string)('some-id');
      expect(url, `${name} must be relative`).not.toMatch(/^https?:\/\//);
      expect(url, `${name} must start with /`).toMatch(/^\//);
    }
  });

  it('covers the paths next.config.ts rewrites', async () => {
    // A path outside these prefixes would not be proxied and would 404.
    const { endpoints } = await loadEndpoints(undefined);
    for (const build of Object.values(endpoints)) {
      const url = (build as (id: string) => string)('x');
      expect(url.startsWith('/api/v1/') || url.startsWith('/health')).toBe(true);
    }
  });
});

describe('direct mode (opt-in)', () => {
  it('prefixes every URL with the configured host', async () => {
    const { endpoints, API_BASE, IS_DIRECT } = await loadEndpoints('http://api.example.com');

    expect(API_BASE).toBe('http://api.example.com');
    expect(IS_DIRECT).toBe(true);
    expect(endpoints.agents()).toBe('http://api.example.com/api/v1/agents');
    expect(endpoints.health()).toBe('http://api.example.com/health');
  });

  it('tolerates a trailing slash', async () => {
    const { endpoints } = await loadEndpoints('http://api.example.com/');
    expect(endpoints.agents()).toBe('http://api.example.com/api/v1/agents');
  });
});
