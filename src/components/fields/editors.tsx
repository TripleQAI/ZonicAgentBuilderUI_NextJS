'use client';

import { useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';

import { FieldShell, type FieldProps } from '@/components/fields/primitives';
import { VariablePickerButton } from '@/components/fields/VariablePicker';

/** Code, markdown, JSON and token-aware text editors. */

export function CodeField({ field, name }: FieldProps) {
  const { register } = useFormContext();
  return (
    <FieldShell field={field}>
      <textarea
        id={field.key}
        rows={field.rows ?? 10}
        spellCheck={false}
        className="prop-textarea font-mono text-[11px] leading-relaxed"
        placeholder={field.placeholder}
        data-language={field.language ?? 'javascript'}
        {...register(name)}
      />
      <div className="prop-hint">
        {String(field.language ?? 'javascript')} · executed only by the runtime, not the editor
      </div>
    </FieldShell>
  );
}

export function MarkdownField({ field, name }: FieldProps) {
  const { register } = useFormContext();
  const value = (useController({ name }).field.value as string) ?? '';
  const [preview, setPreview] = useState(false);

  return (
    <FieldShell field={field}>
      <div className="mb-1 flex justify-end">
        <button
          type="button"
          className="btn-sm readonly-allowed"
          onClick={() => setPreview((p) => !p)}
        >
          <i className={preview ? 'bi-pencil' : 'bi-eye'} />
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
      {preview ? (
        <div className="min-h-[120px] whitespace-pre-wrap rounded-md border border-border bg-bg p-2 text-[12px]">
          {value || <span className="text-text-muted">Nothing to preview</span>}
        </div>
      ) : (
        <textarea
          id={field.key}
          rows={field.rows ?? 8}
          className="prop-textarea font-mono text-[11px]"
          {...register(name)}
        />
      )}
    </FieldShell>
  );
}

/** JSON with parse-on-blur and a red border on failure — the source's UX. */
export function JsonField({ field, name }: FieldProps) {
  const { field: controlled } = useController({ name });
  const [text, setText] = useState(() =>
    JSON.stringify(controlled.value ?? {}, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <FieldShell field={field}>
      <textarea
        id={field.key}
        rows={field.rows ?? 6}
        spellCheck={false}
        className="prop-textarea font-mono text-[11px]"
        style={{ borderColor: error ? 'var(--danger)' : undefined }}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          try {
            controlled.onChange(JSON.parse(text || '{}'));
            setError(null);
          } catch (cause) {
            setError((cause as Error).message);
          }
        }}
      />
      {error && <div className="prop-hint text-danger">{error}</div>}
    </FieldShell>
  );
}

/** Text with a `{{token}}` picker attached — variable_reference / expression /
 *  target_reference / view_template all share this shape. */
function TokenTextField({
  field,
  name,
  rows,
  buttonLabel,
}: FieldProps & { rows?: number; buttonLabel?: string }) {
  const { field: controlled } = useController({ name });
  const value = (controlled.value as string) ?? '';

  const insert = (token: string) => controlled.onChange(`${value}${token}`);

  return (
    <FieldShell field={field}>
      <div className="flex items-start gap-1.5">
        {rows ? (
          <textarea
            id={field.key}
            rows={rows}
            className="prop-textarea flex-1 font-mono text-[11px]"
            placeholder={field.placeholder}
            value={value}
            onChange={(event) => controlled.onChange(event.target.value)}
          />
        ) : (
          <input
            id={field.key}
            className="prop-input flex-1 font-mono text-[11px]"
            placeholder={field.placeholder}
            value={value}
            onChange={(event) => controlled.onChange(event.target.value)}
          />
        )}
        <VariablePickerButton onPick={insert} label={buttonLabel} />
      </div>
    </FieldShell>
  );
}

export function VariableRefField(props: FieldProps) {
  return <TokenTextField {...props} />;
}

export function TargetRefField(props: FieldProps) {
  return <TokenTextField {...props} buttonLabel="Target" />;
}

export function ExpressionField(props: FieldProps) {
  return <TokenTextField {...props} rows={props.field.rows ?? 3} />;
}

export function ViewTemplateField(props: FieldProps) {
  return <TokenTextField {...props} rows={props.field.rows ?? 6} />;
}
