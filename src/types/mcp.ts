/**
 * The MCP configurator's schema, as served by `GET /api/v1/mcp-config-schema`.
 *
 * Mirrors `resources/mcp_config.json`. The dialog renders whatever this
 * declares — sections, fields, defaults, conditionals — so a new field on a
 * tool kind is a backend edit alone.
 */

import type { Option } from '@/lib/registry/optionSets';

/** Render this field only while the draft matches. An array means every rule. */
export interface ShowWhen {
  path: string;
  in?: unknown[];
  notIn?: unknown[];
}

export interface McpField {
  key: string;
  label?: string;
  type: string;
  required?: boolean;
  /** Value must be unique across the configured tools — the tool name. */
  unique?: boolean;
  description?: string;
  placeholder?: string;
  options?: Option[];
  rows?: number;
  min?: number;
  max?: number;
  showWhen?: ShowWhen | ShowWhen[];
}

export interface McpSection {
  title?: string;
  fields: McpField[];
}

export interface McpToolKind {
  value: string;
  label: string;
  badge: string;
  icon: string;
  addLabel: string;
  color: string;
  /** Keys joined with · into the collapsed card's one-line summary. */
  summary: string[];
  defaults: Record<string, unknown>;
  sections: McpSection[];
}

export interface McpParameterColumn {
  key: string;
  label?: string;
  type: string;
  placeholder?: string;
  options?: Option[];
  width?: string;
  required?: boolean;
  /** 1 (default) or 2 — the parameter editor is two rows of controls. */
  row?: number;
}

export interface McpConfigSchema {
  server: McpSection;
  serverDefaults: Record<string, unknown>;
  toolNameRule: { pattern: string; message: string };
  toolKinds: McpToolKind[];
  parameterRow: {
    addLabel: string;
    defaults: Record<string, unknown>;
    columns: McpParameterColumn[];
  };
  cacheKeyConfig: {
    parts: { key: string; label: string }[];
    partSources: Option[];
    digest: {
      label: string;
      addLabel: string;
      placeholder: string;
      defaults: { source: string; value: string };
      sources: Option[];
    };
  };
}

/** One entry of a node's `config.tools`. Only three keys are edited in place. */
export interface ToolRow {
  name?: string;
  type?: string;
  description?: string;
  mcp?: McpServerConfig;
  /** Everything else a row carries — `_id`, `config`, `title` — is preserved. */
  [extra: string]: unknown;
}

export interface McpServerConfig {
  displayName?: string;
  description?: string;
  serverName?: string;
  transportType?: string;
  url?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  configuredTools?: McpConfiguredTool[];
  [extra: string]: unknown;
}

export interface McpConfiguredTool {
  /** Client-side only: React keys and card identity. Stripped before save. */
  id: string;
  toolType: string;
  enabled?: boolean;
  name?: string;
  [extra: string]: unknown;
}
