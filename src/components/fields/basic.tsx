'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { useMemo } from 'react';

import { FieldShell, type FieldProps } from '@/components/fields/primitives';
import { useWorkflowStore } from '@/store/useWorkflowStore';

/** Simple scalar inputs. */

export function TextField({ field, name }: FieldProps) {
  const { register } = useFormContext();
  return (
    <FieldShell field={field}>
      <input
        id={field.key}
        className="prop-input"
        placeholder={field.placeholder}
        {...register(name)}
      />
    </FieldShell>
  );
}

export function TextareaField({ field, name }: FieldProps) {
  const { register } = useFormContext();
  return (
    <FieldShell field={field}>
      <textarea
        id={field.key}
        rows={field.rows ?? 3}
        className="prop-textarea"
        placeholder={field.placeholder}
        {...register(name)}
      />
    </FieldShell>
  );
}

export function NumberField({ field, name }: FieldProps) {
  const { register } = useFormContext();
  return (
    <FieldShell field={field}>
      <input
        id={field.key}
        type="number"
        className="prop-input"
        min={field.min}
        max={field.max}
        step={field.step ?? 'any'}
        {...register(name, { valueAsNumber: true })}
      />
    </FieldShell>
  );
}

export function SwitchField({ field, name }: FieldProps) {
  const { register } = useFormContext();
  return (
    <div className="prop-field flex items-center gap-2">
      <input
        id={field.key}
        type="checkbox"
        className="h-4 w-4 accent-[var(--accent)]"
        {...register(name)}
      />
      <label className="prop-label mb-0 cursor-pointer normal-case" htmlFor={field.key}>
        {field.label}
      </label>
      {field.description && <div className="prop-hint ml-auto">{field.description}</div>}
    </div>
  );
}

export function SelectField({ field, name }: FieldProps) {
  const { register } = useFormContext();
  return (
    <FieldShell field={field}>
      <select id={field.key} className="prop-select" {...register(name)}>
        {!field.required && <option value="">— Select —</option>}
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function MultiSelectField({ field, name }: FieldProps) {
  const { register } = useFormContext();
  return (
    <FieldShell field={field}>
      <select id={field.key} multiple className="prop-select h-24" {...register(name)}>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** Options come from the current canvas rather than the schema. */
function useNodeOptions(excludeSelf = true) {
  const agent = useWorkflowStore((s) => s.currentAgent);
  const selectedId = useWorkflowStore((s) => s.selectedNodeId);
  return useMemo(
    () =>
      (agent?.nodes ?? [])
        .filter((n) => !excludeSelf || n.id !== selectedId)
        .map((n) => ({ value: n.id, label: `${n.name} (${n.type})` })),
    [agent?.nodes, excludeSelf, selectedId],
  );
}

export function NodeSelectField({ field, name }: FieldProps) {
  const { register } = useFormContext();
  const options = useNodeOptions();
  return (
    <FieldShell field={field}>
      <select id={field.key} className="prop-select" {...register(name)}>
        <option value="">— Select node —</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/**
 * `node_multiselect` is the handoff editor — the registry uses it for exactly
 * that, and each entry is a wire on the canvas as well as a config value. It is
 * re-exported rather than wrapped so there is one implementation, not two.
 */
export { HandoffTargetsField as NodeMultiSelectField } from '@/components/fields/handoff';

/** Kept for any future schema that needs a plain multi-select of nodes. */
export function PlainNodeMultiSelect({ field, name }: FieldProps) {
  const { register } = useFormContext();
  const options = useNodeOptions();
  const selected = (useWatch({ name }) as string[] | undefined) ?? [];
  return (
    <FieldShell field={field}>
      <select id={field.key} multiple className="prop-select h-28" {...register(name)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {selected.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selected.map((id) => (
            <span key={id} className="count-badge">
              {options.find((o) => o.value === id)?.label ?? id}
            </span>
          ))}
        </div>
      )}
    </FieldShell>
  );
}
