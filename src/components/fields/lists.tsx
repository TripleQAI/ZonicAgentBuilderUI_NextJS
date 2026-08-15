'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';

import {
  FieldShell,
  ListField,
  type FieldProps,
  type ListColumn,
} from '@/components/fields/primitives';
import { useOptions } from '@/lib/registry/optionSets';
import { useWorkflowStore } from '@/store/useWorkflowStore';

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

/** Tool list — opens the tool picker; MCP entries open the MCP configurator. */
export function ToolListField({ field, name }: FieldProps) {
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });
  const openToolPicker = useWorkflowStore.getState;

  return (
    <FieldShell field={field}>
      <div className="space-y-1.5">
        {fields.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-text-muted">
            No tools attached
          </div>
        )}
        {fields.map((row, index) => {
          const tool = row as unknown as { name?: string; toolType?: string };
          return (
            <div
              key={row.id}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
            >
              <i className="bi-wrench-adjustable text-accent" />
              <span className="min-w-0 flex-1 truncate text-[12px]">{tool.name}</span>
              <span className="count-badge">{tool.toolType ?? 'function'}</span>
              <button
                type="button"
                className="btn-icon hover:text-danger"
                onClick={() => remove(index)}
                title="Detach"
              >
                <i className="bi-x-lg" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="btn-sm w-full justify-center readonly-allowed"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('zonic:open-tool-picker', {
                detail: {
                  onSelect: (tools: { name: string; toolType: string }[]) =>
                    tools.forEach((tool) => append(tool as never)),
                },
              }),
            )
          }
        >
          <i className="bi-plus-lg" />
          Add Tools
        </button>
      </div>
      {openToolPicker === undefined && null}
    </FieldShell>
  );
}
