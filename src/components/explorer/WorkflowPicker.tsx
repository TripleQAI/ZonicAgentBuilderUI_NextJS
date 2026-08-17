'use client';

import { useMemo, useState } from 'react';

import { messages } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { AgentSummary } from '@/types/agent';

/**
 * The Agent Explorer, as a header dropdown: search, pick, or start a new
 * workflow. This is the only agent list in the UI — the left column carries the
 * node palette alone.
 */
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
  const currentId = useWorkflowStore((s) => s.currentAgent?.agenticWorkflowId);

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
        title={messages.AGENT_EXPLORER}
        aria-label={messages.AGENT_EXPLORER}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <i className="bi-chevron-expand" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-1 w-80 rounded-md border border-border bg-panel shadow-xl">
            <div className="prop-section-title mb-0 border-b border-border px-3 py-2">
              <i className="bi-robot mr-1" />
              {messages.AGENT_EXPLORER}
            </div>
            <div className="border-b border-border p-2">
              <input
                autoFocus
                className="prop-input"
                placeholder="Search agents…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <div className="p-3 text-center text-[11px] text-text-muted">
                  {agents.length === 0 ? 'No agents loaded' : 'No agents found'}
                </div>
              )}
              {filtered.map((summary) => (
                <button
                  key={summary.agenticWorkflowId}
                  type="button"
                  className={cn(
                    'block w-full rounded px-2 py-1.5 text-left transition-colors',
                    summary.agenticWorkflowId === currentId
                      ? 'bg-accent/15 text-accent'
                      : 'hover:bg-accent/15',
                  )}
                  onClick={() => {
                    onOpenAgent(summary.agenticWorkflowId, { asRoot: summary.isRoot });
                    setOpen(false);
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <i className={summary.isRoot ? 'bi-house-fill' : 'bi-diagram-2'} />
                    <span className="min-w-0 flex-1 truncate text-[12px]">
                      {summary.displayName || summary.name}
                    </span>
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
