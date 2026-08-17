'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';

import {
  FieldShell,
  ListField,
  type FieldProps,
  type ListColumn,
} from '@/components/fields/primitives';
import { serverSummary, withoutKey } from '@/lib/mcp/schema';
import { useOptions } from '@/lib/registry/optionSets';
import { useWorkflowStore, type ToolDialogRequest } from '@/store/useWorkflowStore';
import type { ToolRow } from '@/types/mcp';

/**
 * The list-shaped widgets.
 *
 * Five of them are the same component with different columns — the repetition
 * the source carried five times over. Their `<select>` options come from the
 * backend's shared option sets, not from arrays declared here.
 */

export function KeyValueListField({ field, name }: FieldProps) {
  const typeOptions = useOptions('mappingTypes');
  const columns: ListColumn[] = [
    { key: 'key', placeholder: field.placeholderKey ?? 'key' },
    { key: 'value', placeholder: field.placeholderVal ?? 'value' },
  ];
  if (field.showType) {
    columns.push({ key: 'type', type: 'select', options: typeOptions, width: 'max-w-[110px]' });
  }
  return (
    <ListField
      field={field}
      name={name}
      columns={columns}
      addLabel="Add Field"
      emptyRow={{ key: '', value: '', ...(field.showType ? { type: 'string' } : {}) }}
    />
  );
}

export function MessageListField({ field, name }: FieldProps) {
  const roles = useOptions('messageRoles');
  return (
    <ListField
      field={field}
      name={name}
      addLabel="Add Message"
      emptyRow={{ role: 'user', content: '' }}
      columns={[
        { key: 'role', type: 'select', options: roles, width: 'max-w-[120px]' },
        { key: 'content', type: 'textarea', placeholder: 'Message content or {{token}}' },
      ]}
    />
  );
}

export function MappingListField({ field, name }: FieldProps) {
  const typeOptions = useOptions('mappingTypes');
  return (
    <ListField
      field={field}
      name={name}
      addLabel="Add Mapping"
      emptyRow={{ target: '', source: '', type: 'string' }}
      columns={[
        { key: 'target', placeholder: 'target field' },
        { key: 'source', placeholder: 'value or {{path}}' },
        { key: 'type', type: 'select', options: typeOptions, width: 'max-w-[110px]' },
      ]}
    />
  );
}

export function StateUpdateListField({ field, name }: FieldProps) {
  const ops = useOptions('stateOps');
  return (
    <ListField
      field={field}
      name={name}
      addLabel="Add Update"
      emptyRow={{ path: '', op: 'set', value: '' }}
      columns={[
        { key: 'path', placeholder: 'variable path' },
        { key: 'op', type: 'select', options: ops, width: 'max-w-[110px]' },
        { key: 'value', placeholder: 'value or {{path}}' },
      ]}
    />
  );
}

export function QueryVarListField({ field, name }: FieldProps) {
  return (
    <ListField
      field={field}
      name={name}
      addLabel="Add Parameter"
      emptyRow={{ name: '', value: '' }}
      columns={[
        { key: 'name', placeholder: 'parameter' },
        { key: 'value', placeholder: 'value or {{path}}' },
      ]}
    />
  );
}

export function SchemaBuilderField({ field, name }: FieldProps) {
  const schemaTypes = useOptions('schemaTypes');
  return (
    <ListField
      field={field}
      name={name}
      addLabel="Add Field"
      emptyRow={{ name: '', type: 'string', description: '', required: false }}
      columns={[
        { key: 'name', placeholder: 'fieldName' },
        { key: 'type', type: 'select', options: schemaTypes, width: 'max-w-[110px]' },
        { key: 'description', placeholder: 'description' },
      ]}
    />
  );
}

/** Rule branches: each row becomes a source handle on the canvas. */
export function ConditionBuilderField({ field, name }: FieldProps) {
  const { control, register } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <FieldShell field={field}>
      <div className="space-y-2">
        {fields.map((row, index) => (
          <div key={row.id} className="rounded-md border border-border p-2">
            <div className="mb-1.5 flex items-center gap-1.5">
              <input
                className="prop-input flex-1"
                placeholder="Branch label"
                {...register(`${name}.${index}.label`)}
              />
              <input
                className="prop-input max-w-[130px] font-mono text-[11px]"
                placeholder="ruleId"
                {...register(`${name}.${index}.ruleId`)}
              />
              <button
                type="button"
                className="btn-icon hover:text-danger"
                onClick={() => remove(index)}
                title="Remove branch"
              >
                <i className="bi-trash" />
              </button>
            </div>
            <input
              className="prop-input font-mono text-[11px]"
              placeholder="Condition expression, e.g. {{nodes.LLM_1.output.result}} == 'yes'"
              {...register(`${name}.${index}.expression`)}
            />
            <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-muted">
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                {...register(`${name}.${index}.isDefault`)}
              />
              Default branch (else)
            </label>
          </div>
        ))}
        <button
          type="button"
          className="btn-sm w-full justify-center"
          onClick={() =>
            append({
              ruleId: `r_${Math.random().toString(36).slice(2, 7)}`,
              label: 'Branch',
              conditions: [],
              conditionLogic: 'AND',
            } as never)
          }
        >
          <i className="bi-plus-lg" />
          Add Branch
        </button>
      </div>
    </FieldShell>
  );
}

/**
 * Tool list — a card per attached tool: name, type, description.
 *
 * A row is edited in place rather than being read-only, as the source's
 * `_buildToolList` did, and the whole row object is carried through so keys the
 * editor does not show — `_id`, `config`, `title`, and an `mcp` server
 * configuration — survive a save. Selecting `mcp` reveals the configurator
 * link, which is the only way into that surface.
 */
export function ToolListField({ field, name }: FieldProps) {
  const { control } = useFormContext();
  const { fields, append, remove, update } = useFieldArray({ control, name });
  const toolTypes = useOptions('toolTypes');
  const nodeId = useWorkflowStore((s) => s.selectedNodeId);
  const openToolDialog = useWorkflowStore((s) => s.openToolDialog);

  const rows = fields as unknown as (ToolRow & { id: string })[];

  return (
    <FieldShell field={field}>
      <div className="space-y-1.5">
        {rows.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-text-muted">
            No tools attached
          </div>
        )}

        {rows.map((row, index) => {
          // react-hook-form stamps its own `id` on each row; it must not be
          // written back into the document.
          const tool = withoutKey(row, 'id') as ToolRow;
          const type = String(tool.type ?? tool.toolType ?? toolTypes[0]?.value ?? '');
          // Only a type the option set marks as configurable shows the link,
          // so nothing here has to know that the type in question is "mcp".
          const option = toolTypes.find((entry) => entry.value === type);
          const summary = serverSummary(tool.mcp);

          return (
            <div key={row.id} className="rounded-md border border-border p-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  className="prop-input min-w-0 flex-[2]"
                  placeholder="Tool name"
                  aria-label={`Tool ${index + 1} name`}
                  value={String(tool.name ?? '')}
                  onChange={(event) => update(index, { ...tool, name: event.target.value })}
                />
                <select
                  className="prop-select min-w-0 flex-[1.5]"
                  aria-label={`Tool ${index + 1} type`}
                  value={type}
                  onChange={(event) => update(index, { ...tool, type: event.target.value })}
                >
                  {!toolTypes.some((option) => option.value === type) && (
                    <option value={type}>{type || '— Select —'}</option>
                  )}
                  {toolTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-icon shrink-0 hover:text-danger"
                  onClick={() => remove(index)}
                  title="Remove"
                  aria-label={`Remove tool ${index + 1}`}
                >
                  <i className="bi-trash3" />
                </button>
              </div>

              <input
                className="prop-input mt-1"
                placeholder="Description (optional)"
                aria-label={`Tool ${index + 1} description`}
                value={String(tool.description ?? '')}
                onChange={(event) => update(index, { ...tool, description: event.target.value })}
              />

              {option?.configurator && (
                <div className="mt-1">
                  {summary && <div className="font-mono text-[10px] text-text-muted">{summary}</div>}
                  <button
                    type="button"
                    className="btn-sm mt-1 readonly-allowed"
                    disabled={!nodeId}
                    onClick={() =>
                      nodeId &&
                      openToolDialog({
                        kind: option.configurator as ToolDialogRequest['kind'],
                        nodeId,
                        toolIndex: index,
                      })
                    }
                  >
                    <i className="bi-gear" />
                    {option.configureLabel ?? option.label}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn-sm flex-1 justify-center"
            onClick={() => append({ name: '', type: toolTypes[0]?.value ?? '', description: '' })}
          >
            <i className="bi-plus-lg" />
            Add Tool
          </button>
          <button
            type="button"
            className="btn-sm flex-1 justify-center readonly-allowed"
            disabled={!nodeId}
            onClick={() => nodeId && openToolDialog({ kind: 'catalog', nodeId, toolIndex: null })}
          >
            <i className="bi-grid" />
            Browse Catalog
          </button>
        </div>
      </div>
    </FieldShell>
  );
}
