'use client';

import { useWorkflowStore } from '@/store/useWorkflowStore';

/** Shown when the module is published; matches the source's banner and action. */
export function ReadOnlyBanner() {
  const isReadOnly = useWorkflowStore((s) => s.isReadOnly);
  const setReadOnly = useWorkflowStore((s) => s.setReadOnly);

  if (!isReadOnly) return null;

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-warning/40 bg-warning/10 px-3 py-1.5 text-[12px] text-warning">
      <i className="bi-lock-fill" />
      This module is published (read-only). Create a draft to enable editing.
      <button
        type="button"
        className="btn-sm readonly-allowed ml-2 border-warning text-warning"
        onClick={() => setReadOnly(false)}
      >
        Enable Editing
      </button>
    </div>
  );
}
