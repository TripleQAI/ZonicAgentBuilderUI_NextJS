'use client';

import type { ComponentType } from 'react';

import { VariablePickerButton } from '@/components/fields/VariablePicker';
import { getDotPath, setDotPath } from '@/lib/utils/dotPath';
import type { McpConfigSchema, McpField } from '@/types/mcp';

/**
 * The configurator's widgets, as a registry.
 *
 * Separate from `FIELD_COMPONENTS` on purpose. Those widgets read
 * react-hook-form context because they render a node's properties form; these
 * edit a plain draft object held by the dialog, so they are controlled by
 * value/onChange and have no form dependency. Adding a widget is one entry at
 * the bottom of this file.
 */

export interface McpFieldProps {
  field: McpField;
  value: unknown;
  onChange: (next: unknown) => void;
  /** The parameter and cache-key editors are themselves schema-driven. */
  schema: McpConfigSchema;
}

function Shell({
  field,
  children,
  inline = false,
}: {
  field: McpField;
  children: React.ReactNode;
  inline?: boolean;
}) {
  if (inline) return <div className="prop-field">{children}</div>;
  return (
    <div className="prop-field">
      {field.label && (
        <label className="prop-label">
          {field.label}
          {field.required && <span className="ml-0.5 text-danger">*</span>}
          {field.description && (
            <span className="ml-1 font-normal text-text-muted">{field.description}</span>
          )}
        </label>
      )}
      {children}
    </div>
  );
}

function TextInput({ field, value, onChange }: McpFieldProps) {
  return (
    <Shell field={field}>
      <input
        className="prop-input"
        placeholder={field.placeholder}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
      />
    </Shell>
  );
}

function TextArea({ field, value, onChange }: McpFieldProps) {
  return (
    <Shell field={field}>
      <textarea
        className="prop-textarea"
        rows={field.rows ?? 2}
        placeholder={field.placeholder}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
      />
    </Shell>
  );
}

/** Plain monospace textarea. The plan calls for CodeMirror here eventually —
 *  the same gap the node registry's `code` fields have. */
function CodeArea({ field, value, onChange }: McpFieldProps) {
  return (
    <Shell field={field}>
      <textarea
        className="prop-textarea font-mono text-[11px]"
        rows={field.rows ?? 8}
        spellCheck={false}
        placeholder={field.placeholder}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
      />
    </Shell>
  );
}

function NumberInput({ field, value, onChange }: McpFieldProps) {
  return (
    <Shell field={field}>
      <input
        type="number"
        className="prop-input w-28"
        min={field.min}
        max={field.max}
        value={value == null || value === '' ? '' : Number(value)}
        onChange={(event) =>
          onChange(event.target.value === '' ? undefined : Number(event.target.value))
        }
      />
    </Shell>
  );
}

function SelectInput({ field, value, onChange }: McpFieldProps) {
  const options = field.options ?? [];
  const current = String(value ?? '');
  return (
    <Shell field={field}>
      <select
        className="prop-select"
        value={current}
        onChange={(event) => onChange(event.target.value)}
      >
        {(field.placeholder || !options.some((o) => o.value === current)) && (
          <option value="">{field.placeholder ?? '— Select —'}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

function SwitchInput({ field, value, onChange }: McpFieldProps) {
  return (
    <Shell field={field} inline>
      <label className="flex cursor-pointer items-center gap-2 text-[12px]">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        {field.label}
      </label>
    </Shell>
  );
}

/** A text input with the shared `{{token}}` picker beside it. */
function VariableInput({ field, value, onChange }: McpFieldProps) {
  return (
    <Shell field={field}>
      <div className="flex items-center gap-1.5">
        <input
          className="prop-input min-w-0 flex-1"
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        />
        <VariablePickerButton onPick={(token) => onChange(token)} />
      </div>
    </Shell>
  );
}

/**
 * `{ key: value }`, not a list of pairs — headers, env, query params and form
 * fields are all stored as objects, so this edits one directly.
 *
 * Rows are held as an array while editing because an object cannot represent a
 * half-typed key: renaming `a` to `ab` one keystroke at a time would otherwise
 * lose the value at `a`.
 */
function KeyValueObject({ field, value, onChange }: McpFieldProps) {
  const record = (value ?? {}) as Record<string, unknown>;
  const rows = Object.entries(record).map(([key, entry]) => ({ key, value: String(entry ?? '') }));

  const commit = (next: { key: string; value: string }[]) => {
    const out: Record<string, string> = {};
    for (const row of next) if (row.key.trim()) out[row.key] = row.value;
    onChange(out);
  };

  return (
    <Shell field={field}>
      <div className="space-y-1">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <input
              className="prop-input min-w-0 flex-1 font-mono text-[11px]"
              placeholder="key"
              value={row.key}
              onChange={(event) =>
                commit(rows.map((r, i) => (i === index ? { ...r, key: event.target.value } : r)))
              }
            />
            <input
              className="prop-input min-w-0 flex-[1.5]"
              placeholder="value"
              value={row.value}
              onChange={(event) =>
                commit(rows.map((r, i) => (i === index ? { ...r, value: event.target.value } : r)))
              }
            />
            <button
              type="button"
              className="btn-icon shrink-0 hover:text-danger"
              title="Remove"
              onClick={() => commit(rows.filter((_, i) => i !== index))}
            >
              <i className="bi-trash3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-sm"
          onClick={() => commit([...rows, { key: '', value: '' }])}
        >
          <i className="bi-plus-lg" />
          Add
        </button>
      </div>
    </Shell>
  );
}

/** An array of plain strings — arguments, allowed tables, required filters. */
function StringList({ field, value, onChange }: McpFieldProps) {
  const items = Array.isArray(value) ? (value as unknown[]).map((v) => String(v ?? '')) : [];

  return (
    <Shell field={field}>
      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <input
              className="prop-input min-w-0 flex-1"
              placeholder={field.placeholder}
              value={item}
              onChange={(event) =>
                onChange(items.map((v, i) => (i === index ? event.target.value : v)))
              }
            />
            <button
              type="button"
              className="btn-icon shrink-0 hover:text-danger"
              title="Remove"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <i className="bi-trash3" />
            </button>
          </div>
        ))}
        <button type="button" className="btn-sm" onClick={() => onChange([...items, ''])}>
          <i className="bi-plus-lg" />
          Add
        </button>
      </div>
    </Shell>
  );
}

/**
 * Dynamic parameter mapping — nine controls per row across two lines, laid out
 * from `parameterRow.columns` rather than written out here.
 */
function ParameterList({ value, onChange, schema }: McpFieldProps) {
  const spec = schema.parameterRow;
  const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

  const patch = (index: number, key: string, next: unknown) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: next } : row)));

  const line = (n: number) => spec.columns.filter((column) => (column.row ?? 1) === n);

  return (
    <div className="space-y-1.5">
      {rows.map((row, index) => (
        <div key={index} className="rounded border border-border p-1.5">
          {[1, 2].map((n) => (
            <div key={n} className={`flex flex-wrap items-center gap-1 ${n === 2 ? 'mt-1' : ''}`}>
              {line(n).map((column) =>
                column.type === 'select' ? (
                  <select
                    key={column.key}
                    className={`prop-select min-w-0 ${column.width ?? 'flex-1'}`}
                    aria-label={column.label ?? column.key}
                    value={String(row[column.key] ?? '')}
                    onChange={(event) => patch(index, column.key, event.target.value)}
                  >
                    {(column.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : column.type === 'switch' ? (
                  <label
                    key={column.key}
                    className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-text-muted"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(row[column.key])}
                      onChange={(event) => patch(index, column.key, event.target.checked)}
                    />
                    {column.label}
                  </label>
                ) : (
                  <input
                    key={column.key}
                    className={`prop-input min-w-0 ${column.width ?? 'flex-1'}`}
                    placeholder={column.placeholder}
                    aria-label={column.placeholder ?? column.key}
                    value={String(row[column.key] ?? '')}
                    onChange={(event) => patch(index, column.key, event.target.value)}
                  />
                ),
              )}
              {n === 1 && (
                <button
                  type="button"
                  className="btn-icon shrink-0 hover:text-danger"
                  title="Remove parameter"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                >
                  <i className="bi-trash3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
      <button
        type="button"
        className="btn-sm"
        onClick={() => onChange([...rows, structuredClone(spec.defaults)])}
      >
        <i className="bi-plus-lg" />
        {spec.addLabel}
      </button>
    </div>
  );
}

/** Namespace / cache type / version, each a source + value, plus the digest. */
function CacheKeyConfig({ value, onChange, schema }: McpFieldProps) {
  const spec = schema.cacheKeyConfig;
  const config = (value ?? {}) as Record<string, unknown>;
  const digest = Array.isArray(config.digest)
    ? (config.digest as { source?: string; value?: string }[])
    : [];

  const patchPart = (key: string, field: 'source' | 'value', next: string) => {
    const copy = structuredClone(config);
    setDotPath(copy, `${key}.${field}`, next);
    onChange(copy);
  };

  return (
    <div className="mt-1 rounded border border-border p-2">
      {spec.parts.map((part) => {
        const source = String(getDotPath(config, `${part.key}.source`) ?? 'fixed');
        return (
          <div key={part.key} className="mb-1 flex items-center gap-1.5">
            <span className="w-20 shrink-0 text-[11px] text-text-muted">{part.label}</span>
            <select
              className="prop-select w-24 shrink-0"
              aria-label={`${part.label} source`}
              value={source}
              onChange={(event) => patchPart(part.key, 'source', event.target.value)}
            >
              {spec.partSources.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              className="prop-input min-w-0 flex-1"
              aria-label={`${part.label} value`}
              // The source swapped this hint with the selected source.
              placeholder={source === 'fixed' ? 'literal value' : `${source}.myVar`}
              value={String(getDotPath(config, `${part.key}.value`) ?? '')}
              onChange={(event) => patchPart(part.key, 'value', event.target.value)}
            />
          </div>
        );
      })}

      <div className="mt-2 text-[11px] text-text-muted">{spec.digest.label}</div>
      {digest.map((entry, index) => (
        <div key={index} className="mt-1 flex items-center gap-1.5">
          <select
            className="prop-select w-24 shrink-0"
            aria-label={`Digest ${index + 1} source`}
            value={entry.source ?? spec.digest.defaults.source}
            onChange={(event) =>
              onChange({
                ...config,
                digest: digest.map((d, i) =>
                  i === index ? { ...d, source: event.target.value } : d,
                ),
              })
            }
          >
            {spec.digest.sources.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="prop-input min-w-0 flex-1"
            aria-label={`Digest ${index + 1} value`}
            placeholder={spec.digest.placeholder}
            value={entry.value ?? ''}
            onChange={(event) =>
              onChange({
                ...config,
                digest: digest.map((d, i) => (i === index ? { ...d, value: event.target.value } : d)),
              })
            }
          />
          <button
            type="button"
            className="btn-icon shrink-0 hover:text-danger"
            title="Remove"
            onClick={() => onChange({ ...config, digest: digest.filter((_, i) => i !== index) })}
          >
            <i className="bi-x-lg" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn-sm mt-1"
        onClick={() =>
          onChange({ ...config, digest: [...digest, { ...spec.digest.defaults }] })
        }
      >
        <i className="bi-plus-lg" />
        {spec.digest.addLabel}
      </button>
    </div>
  );
}

const MCP_FIELD_COMPONENTS: Record<string, ComponentType<McpFieldProps>> = {
  text: TextInput,
  textarea: TextArea,
  code: CodeArea,
  number: NumberInput,
  select: SelectInput,
  switch: SwitchInput,
  variable_reference: VariableInput,
  key_value_object: KeyValueObject,
  string_list: StringList,
  parameter_list: ParameterList,
  cache_key_config: CacheKeyConfig,
};

/** Unknown types fall back to text, as the node field registry does. */
export function resolveMcpField(type: string): ComponentType<McpFieldProps> {
  return MCP_FIELD_COMPONENTS[type] ?? TextInput;
}

export { MCP_FIELD_COMPONENTS };
