'use client';

import { useEffect, useState } from 'react';

import { Modal } from '@/components/dialogs/Modal';

/**
 * Name/value rows, used by System Parameters.
 *
 * Flow Variables started here too, but a variable is a declaration — type,
 * default, description — rather than a pair, so it has its own editor in
 * FlowVariablesDrawer. This stays generic for any surface that is genuinely
 * key/value.
 */
export function KeyValueDrawer({
  open,
  onClose,
  title,
  icon,
  description,
  value,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  description: string;
  value: Record<string, unknown>;
  onSave: (next: Record<string, unknown>) => void;
}) {
  const [rows, setRows] = useState<{ key: string; value: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setRows(
      Object.entries(value).map(([key, entry]) => ({
        key,
        value: typeof entry === 'string' ? entry : JSON.stringify(entry ?? ''),
      })),
    );
  }, [open, value]);

  const commit = () => {
    const next: Record<string, unknown> = {};
    for (const row of rows) {
      if (!row.key.trim()) continue;
      // Keep JSON values as structures; everything else stays a string.
      try {
        next[row.key] = JSON.parse(row.value);
      } catch {
        next[row.key] = row.value;
      }
    }
    onSave(next);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={icon}
      side
      footer={
        <>
          <button
            type="button"
            className="btn-sm mr-auto"
            onClick={() => setRows((current) => [...current, { key: '', value: '' }])}
          >
            <i className="bi-plus-lg" />
            Add
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
      <p className="prop-hint mb-3">{description}</p>

      {rows.length === 0 && (
        <div className="rounded border border-dashed border-border p-4 text-center text-[11px] text-text-muted">
          Nothing defined yet
        </div>
      )}

      <div className="space-y-1.5">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <input
              className="prop-input flex-1 font-mono text-[11px]"
              placeholder="name"
              value={row.key}
              onChange={(event) =>
                setRows((current) =>
                  current.map((r, i) => (i === index ? { ...r, key: event.target.value } : r)),
                )
              }
            />
            <input
              className="prop-input flex-[1.5]"
              placeholder="value"
              value={row.value}
              onChange={(event) =>
                setRows((current) =>
                  current.map((r, i) => (i === index ? { ...r, value: event.target.value } : r)),
                )
              }
            />
            <button
              type="button"
              className="btn-icon hover:text-danger"
              title="Remove"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
            >
              <i className="bi-trash" />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
