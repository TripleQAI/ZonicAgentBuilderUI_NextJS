import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  duplicateTool,
  fromDraft,
  isVisible,
  newConfiguredTool,
  serverSummary,
  summarise,
  toDraft,
  validate,
  validateTool,
} from '@/lib/mcp/schema';
import type { McpConfigSchema, McpConfiguredTool, McpServerConfig } from '@/types/mcp';

/**
 * The MCP configurator's rules. The dialog itself is a renderer — these
 * functions decide what appears and what blocks a save, and they read the
 * schema rather than restating it, which is the property worth pinning down.
 *
 * The schema is the real backend resource, not a fixture: if a field is added
 * there without a default, or a `showWhen` names a path that does not exist,
 * these fail rather than the UI quietly rendering nothing.
 */
const SCHEMA: McpConfigSchema = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      '..',
      'ZonicAgentBuilderServer_FastAPI',
      'app',
      'resources',
      'mcp_config.json',
    ),
    'utf8',
  ),
);

const kind = (value: string) => SCHEMA.toolKinds.find((k) => k.value === value)!;
const field = (toolKind: string, key: string) =>
  kind(toolKind)
    .sections.flatMap((section) => section.fields)
    .find((f) => f.key === key)!;

describe('the schema resource itself', () => {
  it('declares the three tool kinds the source had', () => {
    expect(SCHEMA.toolKinds.map((k) => k.value)).toEqual(['database', 'api', 'function']);
  });

  it('gives every field a defaults entry to seed from', () => {
    // A field with no default renders as undefined and reads as "empty", so a
    // required one would block save on a tool the user never touched.
    for (const toolKind of SCHEMA.toolKinds) {
      const draft = newConfiguredTool(toolKind);
      for (const section of toolKind.sections) {
        for (const f of section.fields) {
          const root = f.key.split('.')[0];
          expect(
            Object.hasOwn(draft, root),
            `${toolKind.value}.${f.key} has no default`,
          ).toBe(true);
        }
      }
    }
  });

  it('points every showWhen at a key the same kind declares', () => {
    for (const toolKind of SCHEMA.toolKinds) {
      const keys = new Set(toolKind.sections.flatMap((s) => s.fields).map((f) => f.key));
      for (const section of toolKind.sections) {
        for (const f of section.fields) {
          const rules = !f.showWhen ? [] : Array.isArray(f.showWhen) ? f.showWhen : [f.showWhen];
          for (const rule of rules) {
            expect(keys.has(rule.path), `${toolKind.value}: ${f.key} watches ${rule.path}`).toBe(
              true,
            );
          }
        }
      }
    }
  });
});

describe('conditional visibility', () => {
  it('shows a field with no rule', () => {
    expect(isVisible(field('database', 'name'), {})).toBe(true);
  });

  it('shows the script only for a configured script', () => {
    const script = field('database', 'script');
    expect(isVisible(script, { scriptSourceType: 'configured_script' })).toBe(true);
    expect(isVisible(script, { scriptSourceType: 'approved_template' })).toBe(false);
  });

  it('hides the request body on a verb that has none', () => {
    const bodyType = field('api', 'bodyType');
    expect(isVisible(bodyType, { method: 'POST' })).toBe(true);
    expect(isVisible(bodyType, { method: 'GET' })).toBe(false);
    expect(isVisible(bodyType, { method: 'DELETE' })).toBe(false);
  });

  it('requires every rule to hold when a field lists several', () => {
    const template = field('api', 'bodyTemplate');
    expect(isVisible(template, { method: 'POST', bodyType: 'json' })).toBe(true);
    // Right body type, wrong verb — the source dropped this case and left the
    // editor visible under GET until the section was re-rendered.
    expect(isVisible(template, { method: 'GET', bodyType: 'json' })).toBe(false);
    expect(isVisible(template, { method: 'POST', bodyType: 'form_data' })).toBe(false);
  });

  it('reads a nested path', () => {
    const cache = field('database', 'result.cacheKeyConfig');
    expect(isVisible(cache, { result: { saveToCache: true } })).toBe(true);
    expect(isVisible(cache, { result: { saveToCache: false } })).toBe(false);
  });
});

describe('validation', () => {
  const server = (over: Partial<McpServerConfig> = {}): McpServerConfig => ({
    ...toDraft(undefined, SCHEMA),
    serverName: 'tripleq-energy-mcp',
    url: 'http://localhost:8001/mcp',
    ...over,
  });

  const dbTool = (over: Partial<McpConfiguredTool> = {}): McpConfiguredTool => ({
    ...newConfiguredTool(kind('database')),
    name: 'get_bills',
    description: 'Fetch bills.',
    connectionName: 'bndw_readonly',
    script: 'SELECT 1',
    ...over,
  });

  it('passes a complete configuration', () => {
    expect(validate(server({ configuredTools: [dbTool()] }), SCHEMA)).toEqual([]);
  });

  it('requires the server name', () => {
    expect(validate(server({ serverName: '' }), SCHEMA)).toContain('Server Name is required.');
  });

  it('requires the URL only for an http transport', () => {
    expect(validate(server({ url: '' }), SCHEMA)).toContain('Server URL is required.');
    expect(
      validate(server({ transportType: 'stdio', url: '', command: 'python' }), SCHEMA),
    ).toEqual([]);
  });

  it('requires the command only for stdio', () => {
    expect(validate(server({ transportType: 'stdio', command: '' }), SCHEMA)).toContain(
      'Command is required.',
    );
  });

  it('does not require a field the conditionals have hidden', () => {
    // Script is required, but not while the source is an approved template —
    // the template name is required instead.
    const tool = dbTool({ scriptSourceType: 'approved_template', script: '' });
    const errors = validate(server({ configuredTools: [tool] }), SCHEMA);

    expect(errors.some((e) => e.includes('Script is required'))).toBe(false);
    expect(errors.some((e) => e.includes('Template Name is required'))).toBe(true);
  });

  it('rejects a tool name that is not snake_case', () => {
    const errors = validate(server({ configuredTools: [dbTool({ name: 'GetBills' })] }), SCHEMA);
    expect(errors.some((e) => e.includes('lowercase snake_case'))).toBe(true);
  });

  it('rejects two tools with the same name', () => {
    const errors = validate(
      server({ configuredTools: [dbTool(), dbTool({ id: 'other' })] }),
      SCHEMA,
    );
    expect(errors.some((e) => e.includes('must be unique'))).toBe(true);
  });

  it('names the tool it is complaining about', () => {
    const errors = validate(
      server({ configuredTools: [dbTool(), dbTool({ id: 'x', name: '', description: '' })] }),
      SCHEMA,
    );
    expect(errors.some((e) => e.startsWith('Database Tool 2 (unnamed):'))).toBe(true);
  });

  it('checks one tool on its own for the test button', () => {
    expect(validateTool(dbTool(), SCHEMA)).toEqual([]);
    expect(validateTool(dbTool({ connectionName: '' }), SCHEMA)).toContain(
      'Connection Name is required.',
    );
  });

  it('reports a parameter with no name', () => {
    const tool = dbTool({ parameters: [{ name: '' }] });
    expect(validateTool(tool, SCHEMA)).toContain('Parameter 1: Name is required.');
  });
});

describe('the draft round trip', () => {
  it('keeps keys the configurator does not show', () => {
    // Same overlay rule the document follows: an unknown key must survive.
    const stored = {
      serverName: 'srv',
      customExtension: { keep: true },
      configuredTools: [{ toolType: 'database', name: 'a', vendorField: 7 }],
    } as unknown as McpServerConfig;

    const saved = fromDraft(toDraft(stored, SCHEMA));

    expect(saved.customExtension).toEqual({ keep: true });
    expect(saved.configuredTools?.[0].vendorField).toBe(7);
  });

  it('strips the card ids it added', () => {
    const draft = toDraft({ configuredTools: [{ toolType: 'api' }] } as McpServerConfig, SCHEMA);
    expect(draft.configuredTools?.[0].id).toBeTruthy();
    expect(fromDraft(draft).configuredTools?.[0]).not.toHaveProperty('id');
  });

  it('fills in the containers the editor writes into', () => {
    const draft = toDraft(undefined, SCHEMA);
    expect(draft.headers).toEqual({});
    expect(draft.env).toEqual({});
    expect(draft.args).toEqual([]);
    expect(draft.configuredTools).toEqual([]);
  });

  it('gives each new tool its own copy of the defaults', () => {
    const first = newConfiguredTool(kind('database'));
    const second = newConfiguredTool(kind('database'));
    (first.result as { maxRows: number }).maxRows = 5;

    expect((second.result as { maxRows: number }).maxRows).toBe(100);
    expect(first.id).not.toBe(second.id);
  });

  it('duplicates a tool under a new id and name', () => {
    const original = newConfiguredTool(kind('api'));
    original.name = 'call_api';
    const copy = duplicateTool(original);

    expect(copy.name).toBe('call_api_copy');
    expect(copy.id).not.toBe(original.id);
  });
});

describe('summaries', () => {
  it('joins the kind’s summary keys', () => {
    const tool = {
      ...newConfiguredTool(kind('api')),
      name: 'call_api',
      method: 'POST',
      url: 'https://x.test',
      authType: 'none',
    };
    expect(summarise(tool, kind('api'))).toBe('call_api · POST · https://x.test · none');
  });

  it('says (unnamed) rather than opening with a separator', () => {
    expect(summarise(newConfiguredTool(kind('function')), kind('function'))).toContain('(unnamed)');
  });

  it('describes the server on the tool row', () => {
    expect(
      serverSummary({ serverName: 'default', transportType: 'streamable_http', configuredTools: [] }),
    ).toBe('MCP: default · streamable_http · 0 configured tools');
  });

  it('says "1 configured tool" for one', () => {
    expect(
      serverSummary({
        serverName: 'default',
        transportType: 'stdio',
        configuredTools: [{ id: 'a', toolType: 'api' }],
      }),
    ).toBe('MCP: default · stdio · 1 configured tool');
  });

  it('shows nothing until a server is named', () => {
    expect(serverSummary(undefined)).toBeNull();
    expect(serverSummary({ transportType: 'sse' })).toBeNull();
  });
});
