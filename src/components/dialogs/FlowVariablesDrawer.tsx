'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Modal } from '@/components/dialogs/Modal';
import {
  duplicateNames,
  newRow,
  toRows,
  toVariables,
  type FlowVariableRow,
} from '@/lib/agent/flowVariables';
import { useOptions } from '@/lib/registry/optionSets';

/**
 * The flow variable editor (the source's flow_variables.js drawer).
 *
 * A flow variable is a declaration, not a value: it has a type, an optional
 * default and an optional description, and nodes reference it by name. So this
 * is a card per variable rather than the name/value rows System Parameters
 * still use — those really are pairs.
 *
 * The type list comes from the `variableTypes` option set, which is also where
 * each type's swatch colour lives, so adding a type is one line of backend JSON
 * and no change here.
 */
export function FlowVariablesDrawer({
  open,
  onClose,
  value,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  value: Record<string, unknown>;
  onSave: (next: Record<string, unknown>) => void;
}) {
  const types = useOptions('variableTypes');
  const defaultType = types[0]?.value ?? '';

  const [rows, setRows] = useState<FlowVariableRow[]>([]);
  /** Index whose name input should take focus — the row just added. */
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(toRows(value, defaultType));
    setFocusIndex(null);
  }, [defaultType, open, value]);

  const patch = (index: number, change: Partial<FlowVariableRow>) =>
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...change } : r)));

  const commit = () => {
    const clashes = duplicateNames(rows);
    if (clashes.length) {
      // Saving would keep only the last of each: the stored shape is keyed by name.
      toast.error(`Duplicate variable name: ${clashes.join(', ')}`);
      return;
    }
    onSave(toVariables(rows));
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Flow Variables"
      icon="bi-database"
      side
      footer={
        <>
          <button
            type="button"
            className="btn-sm mr-auto"
            onClick={() => {
              setRows((current) => [...current, newRow(defaultType)]);
              setFocusIndex(rows.length);
            }}
          >
            <i className="bi-plus-lg" />
            Add Variable
          </button>
          <button type="button" className="btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={commit}>
            <i className="bi-floppy" />
            Save
          </button>
        </>
      }
    >
      <p className="prop-hint mb-3">
        Define variables for this workflow. Reference them in any node field as{' '}
        <code>{'{{variableName}}'}</code>.
      </p>

      {rows.length === 0 && (
        <div className="rounded border border-dashed border-border p-6 text-center text-[11px] text-text-muted">
          <i className="bi-database mb-2 block text-[32px]" />
          No variables defined yet.
          <br />
          Click <strong>Add Variable</strong> to get started.
        </div>
      )}

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="rounded border border-border p-2">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-border text-[10px] text-text-muted">
                {index + 1}
              </span>
              <input
                autoFocus={index === focusIndex}
                className="prop-input min-w-0 flex-1 font-mono text-[12px]"
                placeholder="variableName"
                aria-label={`Variable ${index + 1} name`}
                value={row.name}
                onChange={(event) => patch(index, { name: event.target.value })}
              />
              <select
                className="prop-select w-32 shrink-0 border-l-[3px]"
                aria-label={`Variable ${index + 1} type`}
                // The swatch is the option's own colour, as node types carry theirs.
                style={{
                  borderLeftColor:
                    types.find((t) => t.value === row.type)?.color ?? 'var(--text-muted)',
                }}
                value={row.type}
                onChange={(event) => patch(index, { type: event.target.value })}
              >
                {/* A stored type the option set no longer lists still shows, so
                    opening the editor cannot quietly change it on save. */}
                {!types.some((t) => t.value === row.type) && (
                  <option value={row.type}>{row.type || '— Select —'}</option>
                )}
                {types.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-icon shrink-0 hover:text-danger"
                title="Remove variable"
                aria-label={`Remove variable ${index + 1}`}
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              >
                <i className="bi-trash" />
              </button>
            </div>

            <div className="mt-1.5 flex gap-1.5">
              <div className="min-w-0 flex-1">
                <label className="prop-label" htmlFor={`fv-default-${index}`}>
                  Default Value
                </label>
                <input
                  id={`fv-default-${index}`}
                  className="prop-input"
                  placeholder="Optional"
                  value={row.default}
                  onChange={(event) => patch(index, { default: event.target.value })}
                />
              </div>
              <div className="min-w-0 flex-[2]">
                <label className="prop-label" htmlFor={`fv-description-${index}`}>
                  Description
                </label>
                <input
                  id={`fv-description-${index}`}
                  className="prop-input"
                  placeholder="Optional"
                  value={row.description}
                  onChange={(event) => patch(index, { description: event.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
