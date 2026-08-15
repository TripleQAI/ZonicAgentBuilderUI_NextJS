'use client';

import { useFieldArray, useFormContext, type FieldValues } from 'react-hook-form';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';
import type { FormField } from '@/types/registry';

/**
 * Shared building blocks for the field components.
 *
 * Every field takes the same props — `{field, name}` — and reads/writes through
 * react-hook-form using the schema's dot-path as the field name. That identity
 * (`field.key === RHF name`) is what deletes the `_get`/`_set` path plumbing
 * that made up much of dynamic_fields.js.
 */

export interface FieldProps {
  field: FormField;
  name: string;
}

export function FieldShell({
  field,
  children,
}: {
  field: FormField;
  children: ReactNode;
}) {
  return (
    <div className="prop-field">
      {field.label && (
        <label className="prop-label" htmlFor={field.key}>
          {field.label}
          {field.required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {field.description && <div className="prop-hint">{field.description}</div>}
    </div>
  );
}

/** A repeating list of rows, parameterised by column descriptors.
 *
 *  Five of the source's list widgets (key/value, message, mapping, state update,
 *  query variable) differ only in their columns, so they share this one
 *  primitive instead of five near-identical implementations. */
export interface ListColumn {
  key: string;
  placeholder?: string;
  type?: 'text' | 'textarea' | 'select';
  options?: { value: string; label: string }[];
  width?: string;
}

export function ListField({
  field,
  name,
  columns,
  addLabel = 'Add',
  emptyRow,
}: FieldProps & {
  columns: ListColumn[];
  addLabel?: string;
  emptyRow: Record<string, unknown>;
}) {
  const { control, register } = useFormContext<FieldValues>();
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <FieldShell field={field}>
      <div className="space-y-1.5">
        {fields.map((row, index) => (
          <div key={row.id} className="flex items-start gap-1.5">
            {columns.map((column) => (
              <div key={column.key} className={cn('min-w-0 flex-1', column.width)}>
                {column.type === 'select' ? (
                  <select
                    className="prop-select"
                    {...register(`${name}.${index}.${column.key}` as never)}
                  >
                    {(column.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : column.type === 'textarea' ? (
                  <textarea
                    rows={2}
                    className="prop-textarea"
                    placeholder={column.placeholder}
                    {...register(`${name}.${index}.${column.key}` as never)}
                  />
                ) : (
                  <input
                    className="prop-input"
                    placeholder={column.placeholder}
                    {...register(`${name}.${index}.${column.key}` as never)}
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn-icon shrink-0 hover:text-danger"
              onClick={() => remove(index)}
              title="Remove"
            >
              <i className="bi-trash" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-sm w-full justify-center"
          onClick={() => append(emptyRow as never)}
        >
          <i className="bi-plus-lg" />
          {field.addLabel ?? addLabel}
        </button>
      </div>
    </FieldShell>
  );
}
