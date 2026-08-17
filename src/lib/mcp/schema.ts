/**
 * The rules behind the MCP configurator, kept out of the dialog.
 *
 * Visibility and validation both read the same schema, which is the point: in
 * the source they were separate code — `_renderSrcCond` decided what to show,
 * `_validate` decided what was required — and the two drifted. Here a field is
 * required only while it is visible, by construction.
 */

import { getDotPath } from '@/lib/utils/dotPath';
import type {
  McpConfigSchema,
  McpConfiguredTool,
  McpField,
  McpServerConfig,
  McpToolKind,
  ShowWhen,
} from '@/types/mcp';

/** Client-side card identity; never saved. */
let counter = 0;
export function nextToolId(): string {
  counter += 1;
  return `mt${counter}`;
}

function matches(rule: ShowWhen, draft: unknown): boolean {
  const value = getDotPath(draft, rule.path);
  if (rule.in && !rule.in.includes(value)) return false;
  if (rule.notIn && rule.notIn.includes(value)) return false;
  return true;
}

/** Whether a field renders against this draft. No rule means always. */
export function isVisible(field: McpField, draft: unknown): boolean {
  if (!field.showWhen) return true;
  const rules = Array.isArray(field.showWhen) ? field.showWhen : [field.showWhen];
  return rules.every((rule) => matches(rule, draft));
}

/** Visible fields of a section, in declaration order. */
export function visibleFields(fields: McpField[], draft: unknown): McpField[] {
  return fields.filter((field) => isVisible(field, draft));
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** A configured tool with a fresh id and the kind's defaults deep-copied. */
export function newConfiguredTool(kind: McpToolKind): McpConfiguredTool {
  return {
    ...(structuredClone(kind.defaults) as Record<string, unknown>),
    id: nextToolId(),
    toolType: kind.value,
  } as McpConfiguredTool;
}

/** A copy, as the source's duplicate button made: new id, `_copy` name. */
export function duplicateTool(tool: McpConfiguredTool): McpConfiguredTool {
  return {
    ...(structuredClone(tool) as McpConfiguredTool),
    id: nextToolId(),
    name: `${tool.name ?? ''}_copy`,
  };
}

/** Seed the draft: schema defaults, then whatever the row already stored. */
export function toDraft(
  stored: McpServerConfig | undefined,
  schema: McpConfigSchema,
): McpServerConfig {
  const draft: McpServerConfig = {
    ...(structuredClone(schema.serverDefaults) as McpServerConfig),
    ...(stored ? (structuredClone(stored) as McpServerConfig) : {}),
  };

  draft.headers ??= {};
  draft.env ??= {};
  if (!Array.isArray(draft.args)) draft.args = [];

  // Give every configured tool a card id, and remember its kind so a document
  // written before a kind existed still renders under something.
  draft.configuredTools = (
    Array.isArray(draft.configuredTools) ? draft.configuredTools : []
  ).map((tool) => ({ ...tool, id: tool.id || nextToolId() }));

  return draft;
}

/** Strip the client-side card ids the draft added. */
export function fromDraft(draft: McpServerConfig): McpServerConfig {
  return {
    ...draft,
    configuredTools: (draft.configuredTools ?? []).map((tool) => withoutKey(tool, 'id')),
  };
}

/** A copy without one key — used for ids that exist only while editing. */
export function withoutKey<T extends object>(value: T, key: string): T {
  const copy = { ...value } as Record<string, unknown>;
  delete copy[key];
  return copy as T;
}

export function kindOf(
  tool: McpConfiguredTool,
  schema: McpConfigSchema,
): McpToolKind | undefined {
  return schema.toolKinds.find((kind) => kind.value === tool.toolType);
}

/** The collapsed card's one line: the kind's summary keys, `·` separated. */
export function summarise(tool: McpConfiguredTool, kind: McpToolKind | undefined): string {
  const keys = kind?.summary ?? ['name'];
  const parts = keys.map((key, index) => {
    const value = getDotPath(tool, key);
    // The source showed "(unnamed)" rather than an empty leading separator.
    if (index === 0) return String(value || '') || '(unnamed)';
    return value == null || value === '' ? '' : String(value);
  });
  return parts.filter(Boolean).join(' · ');
}

/**
 * Every problem that blocks a save, in the order the form presents them.
 *
 * Derived from the schema: a field is required only when it is both marked
 * required and currently visible, which is what keeps this in step with the
 * conditionals rather than restating them.
 */
export function validate(draft: McpServerConfig, schema: McpConfigSchema): string[] {
  const errors: string[] = [];

  for (const field of schema.server.fields) {
    if (field.required && isVisible(field, draft) && isEmpty(getDotPath(draft, field.key))) {
      errors.push(`${field.label ?? field.key} is required.`);
    }
  }

  const namePattern = new RegExp(schema.toolNameRule.pattern);
  const seen = new Set<string>();

  (draft.configuredTools ?? []).forEach((tool, index) => {
    const kind = kindOf(tool, schema);
    const label = `${kind?.label ?? tool.toolType} ${index + 1} (${tool.name || 'unnamed'})`;

    for (const section of kind?.sections ?? []) {
      for (const field of section.fields) {
        if (!isVisible(field, tool)) continue;
        const value = getDotPath(tool, field.key);

        if (field.required && isEmpty(value)) {
          errors.push(`${label}: ${field.label ?? field.key} is required.`);
          continue;
        }
        if (field.unique && typeof value === 'string' && value) {
          if (!namePattern.test(value)) {
            errors.push(`${label}: ${schema.toolNameRule.message}`);
          } else if (seen.has(value)) {
            errors.push(`${label}: "${value}" must be unique.`);
          } else {
            seen.add(value);
          }
        }
      }
    }
  });

  return errors;
}

/** The same check for one tool, behind its "Test Tool Configuration" button. */
export function validateTool(
  tool: McpConfiguredTool,
  schema: McpConfigSchema,
): string[] {
  const kind = kindOf(tool, schema);
  const errors: string[] = [];

  for (const section of kind?.sections ?? []) {
    for (const field of section.fields) {
      if (field.required && isVisible(field, tool) && isEmpty(getDotPath(tool, field.key))) {
        errors.push(`${field.label ?? field.key} is required.`);
      }
    }
  }

  (tool.parameters as { name?: string }[] | undefined)?.forEach((parameter, index) => {
    if (!parameter?.name) errors.push(`Parameter ${index + 1}: Name is required.`);
  });

  return errors;
}

/** The summary line the tool row shows next to "Configure MCP Tools". */
export function serverSummary(mcp: McpServerConfig | undefined): string | null {
  if (!mcp?.serverName) return null;
  const count = Array.isArray(mcp.configuredTools) ? mcp.configuredTools.length : 0;
  const transport = mcp.transportType ?? '';
  return `MCP: ${mcp.serverName} · ${transport} · ${count} configured tool${
    count === 1 ? '' : 's'
  }`;
}
