'use client';

import { useMemo, useState } from 'react';

import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { AgentSummary } from '@/types/agent';

/** The header dropdown: search, pick, or start a new workflow. */
export function WorkflowPicker({
  agents,
  onOpenAgent,
}: {
  agents: AgentSummary[];
  onOpenAgent: (id: string, options?: { asRoot?: boolean }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const newAgent = useWorkflowStore((s) => s.newAgent);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return agents.filter(
      (a) =>
        a.displayName.toLowerCase().includes(needle) ||
        a.name.toLowerCase().includes(needle),
    );
  }, [agents, query]);

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-icon"
        title="Switch workflow"
        onClick={() => setOpen((o) => !o)}
      >
        <i className="bi-chevron-expand" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-1 w-80 rounded-md border border-border bg-panel shadow-xl">
            <div className="border-b border-border p-2">
              <input
                autoFocus
                className="prop-input"
                placeholder="Search workflows…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <div className="p-3 text-center text-[11px] text-text-muted">
                  No workflows found
                </div>
              )}
              {filtered.map((summary) => (
                <button
                  key={summary.agenticWorkflowId}
                  type="button"
                  className="block w-full rounded px-2 py-1.5 text-left hover:bg-accent/15"
                  onClick={() => {
                    onOpenAgent(summary.agenticWorkflowId, { asRoot: summary.isRoot });
                    setOpen(false);
                  }}
                >
                  <span className="block truncate text-[12px] text-text-primary">
                    {summary.displayName || summary.name}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {summary.nodeCount} nodes · {summary.edgeCount} edges
                    {summary.isRoot && ' · root'}
                  </span>
                </button>
              ))}
            </div>
            <div className="border-t border-border p-2">
              <button
                type="button"
                className="btn-sm w-full justify-center"
                onClick={() => {
                  newAgent();
                  setOpen(false);
                }}
              >
                <i className="bi-plus-lg" />
                New Workflow
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
