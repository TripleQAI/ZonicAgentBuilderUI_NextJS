'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Modal } from '@/components/dialogs/Modal';
import { resolveMcpField } from '@/components/dialogs/mcp/McpFields';
import { api } from '@/lib/api/client';
import {
  duplicateTool,
  fromDraft,
  isVisible,
  kindOf,
  newConfiguredTool,
  summarise,
  toDraft,
  validate,
  validateTool,
} from '@/lib/mcp/schema';
import { cn } from '@/lib/utils/cn';
import { getDotPath, setDotPath } from '@/lib/utils/dotPath';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type {
  McpConfigSchema,
  McpConfiguredTool,
  McpField,
  McpSection,
  McpServerConfig,
  ToolRow,
} from '@/types/mcp';

/**
 * MCP Tool Configuration — the source's mcp_modal.js.
 *
 * Everything the dialog shows comes from `GET /mcp-config-schema`: the server
 * fields, the three tool kinds and their sections, the defaults, which fields
 * appear when, and what is required. Nothing about a database tool or an HTTP
 * tool is written here, which is why this is a few hundred lines rather than
 * the source's 1,347.
 */

export function useMcpSchema() {
  return useQuery({
    queryKey: ['mcp-config-schema'],
    queryFn: api.getMcpConfigSchema,
    staleTime: Infinity,
  });
}

/** One field, resolved through the widget registry and bound to a dot-path. */
function Field({
  field,
  draft,
  schema,
  onPatch,
}: {
  field: McpField;
  draft: unknown;
  schema: McpConfigSchema;
  onPatch: (key: string, value: unknown) => void;
}) {
  const Component = resolveMcpField(field.type);
  return (
    <Component
      field={field}
      schema={schema}
      value={getDotPath(draft, field.key)}
      onChange={(next) => onPatch(field.key, next)}
    />
  );
}

function Section({
  section,
  draft,
  schema,
  onPatch,
}: {
  section: McpSection;
  draft: unknown;
  schema: McpConfigSchema;
  onPatch: (key: string, value: unknown) => void;
}) {
  const fields = section.fields.filter((field) => isVisible(field, draft));
  if (fields.length === 0) return null;

  return (
    <div className={section.title ? 'mt-2 rounded border border-border p-2' : undefined}>
      {section.title && <div className="prop-section-title">{section.title}</div>}
      {fields.map((field) => (
        <Field key={field.key} field={field} draft={draft} schema={schema} onPatch={onPatch} />
      ))}
    </div>
  );
}

function ToolCard({
  tool,
  index,
  schema,
  onPatch,
  onReplace,
  onRemove,
  onDuplicate,
}: {
  tool: McpConfiguredTool;
  index: number;
  schema: McpConfigSchema;
  onPatch: (key: string, value: unknown) => void;
  onReplace: (next: McpConfiguredTool) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const kind = kindOf(tool, schema);

  return (
    <div className="mb-2 rounded border border-border">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <input
          type="checkbox"
          title="Enable tool"
          aria-label={`Enable tool ${index + 1}`}
          checked={tool.enabled !== false}
          onChange={(event) => onReplace({ ...tool, enabled: event.target.checked })}
        />
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold text-white"
          style={{ background: kind?.color ?? 'var(--text-muted)' }}
        >
          {kind?.badge ?? tool.toolType}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px]">{summarise(tool, kind)}</span>
        <button type="button" className="btn-icon" title="Duplicate" onClick={onDuplicate}>
          <i className="bi-copy" />
        </button>
        <button
          type="button"
          className="btn-icon hover:text-danger"
          title="Delete"
          onClick={onRemove}
        >
          <i className="bi-trash3" />
        </button>
        <button
          type="button"
          className="btn-icon"
          title="Expand / collapse"
          aria-expanded={open}
          aria-label={`Expand tool ${index + 1}`}
          onClick={() => setOpen((o) => !o)}
        >
          <i className={cn('bi-chevron-down transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div className="border-t border-border p-2">
          {(kind?.sections ?? []).map((section, i) => (
            <Section
              key={section.title ?? i}
              section={section}
              draft={tool}
              schema={schema}
              onPatch={onPatch}
            />
          ))}
          <button
            type="button"
            className="btn-sm mt-2"
            onClick={() => {
              const problems = validateTool(tool, schema);
              if (problems.length) toast.error(problems.join('\n'));
              // The source's test button validated only — it never executed
              // anything — so this reports the same thing it did.
              else toast.success(`${kind?.label ?? 'Tool'} configuration is valid.`);
            }}
          >
            <i className="bi-check2-circle" />
            Test Tool Configuration
          </button>
        </div>
      )}
    </div>
  );
}

export function McpConfigDialog({
  open,
  nodeId,
  toolIndex,
  onClose,
}: {
  open: boolean;
  nodeId: string | null;
  toolIndex: number | null;
  onClose: () => void;
}) {
  const { data: schema, isLoading, error } = useMcpSchema();
  const updateNodePath = useWorkflowStore((s) => s.updateNodePath);
  const refreshForm = useWorkflowStore((s) => s.refreshForm);
  const [draft, setDraft] = useState<McpServerConfig | null>(null);

  useEffect(() => {
    if (!open || !schema || nodeId == null || toolIndex == null) return;
    const node = useWorkflowStore.getState().currentAgent?.nodes.find((n) => n.id === nodeId);
    const tools = ((node?.config?.tools ?? []) as ToolRow[]) ?? [];
    setDraft(toDraft(tools[toolIndex]?.mcp, schema));
  }, [nodeId, open, schema, toolIndex]);

  if (!open) return null;

  const patchServer = (key: string, value: unknown) =>
    setDraft((current) => {
      if (!current) return current;
      const copy = structuredClone(current);
      setDotPath(copy as unknown as Record<string, unknown>, key, value);
      return copy;
    });

  const patchTool = (id: string, key: string, value: unknown) =>
    setDraft((current) => {
      if (!current) return current;
      const copy = structuredClone(current);
      const tool = (copy.configuredTools ?? []).find((t) => t.id === id);
      if (tool) setDotPath(tool as unknown as Record<string, unknown>, key, value);
      return copy;
    });

  const replaceTools = (next: McpConfiguredTool[]) =>
    setDraft((current) => (current ? { ...current, configuredTools: next } : current));

  const save = () => {
    if (!schema || !draft || nodeId == null || toolIndex == null) return;

    const problems = validate(draft, schema);
    if (problems.length) {
      toast.error(problems.slice(0, 8).join('\n'));
      return;
    }

    const node = useWorkflowStore.getState().currentAgent?.nodes.find((n) => n.id === nodeId);
    const tools = structuredClone((node?.config?.tools ?? []) as ToolRow[]);
    if (!tools[toolIndex]) {
      onClose();
      return;
    }

    tools[toolIndex].mcp = fromDraft(draft);
    // The source filled an empty row name from the server's display name.
    if (!tools[toolIndex].name && draft.displayName) tools[toolIndex].name = draft.displayName;

    updateNodePath(nodeId, 'config.tools', tools);
    // The properties form holds its own copy of config.tools, so it has to
    // re-seed or the row would still show the old summary.
    refreshForm();
    onClose();
  };

  const tools = draft?.configuredTools ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="MCP Tool Configuration"
      icon="bi-gear"
      width="lg"
      footer={
        <>
          <button type="button" className="btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={!draft} onClick={save}>
            <i className="bi-floppy" />
            Save
          </button>
        </>
      }
    >
      {isLoading && <div className="p-2 text-[12px] text-text-muted">Loading schema…</div>}
      {error && (
        <div className="p-2 text-[12px] text-danger">
          Could not load the MCP schema: {(error as Error).message}
        </div>
      )}

      {schema && draft && (
        <>
          <div className="prop-section-title">{schema.server.title}</div>
          {schema.server.fields
            .filter((field) => isVisible(field, draft))
            .map((field) => (
              <Field
                key={field.key}
                field={field}
                draft={draft}
                schema={schema}
                onPatch={patchServer}
              />
            ))}

          <div className="prop-section-title mt-4">Configured Tools</div>
          {tools.length === 0 && (
            <div className="rounded border border-dashed border-border p-4 text-center text-[11px] text-text-muted">
              No tools configured yet.
            </div>
          )}
          {tools.map((tool, index) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              index={index}
              schema={schema}
              onPatch={(key, value) => patchTool(tool.id, key, value)}
              onReplace={(next) =>
                replaceTools(tools.map((t) => (t.id === tool.id ? next : t)))
              }
              onRemove={() => replaceTools(tools.filter((t) => t.id !== tool.id))}
              onDuplicate={() =>
                replaceTools([
                  ...tools.slice(0, index + 1),
                  duplicateTool(tool),
                  ...tools.slice(index + 1),
                ])
              }
            />
          ))}

          <div className="mt-2 flex flex-wrap gap-2">
            {schema.toolKinds.map((kind) => (
              <button
                key={kind.value}
                type="button"
                className="btn-sm"
                onClick={() => replaceTools([...tools, newConfiguredTool(kind)])}
              >
                <i className={kind.icon} />
                {kind.addLabel}
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
