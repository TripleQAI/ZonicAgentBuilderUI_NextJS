'use client';

import { useCallback, useRef, useState } from 'react';

import { Modal } from '@/components/dialogs/Modal';
import { runMock, type TraceEntry } from '@/lib/runtime/mockEngine';
import { useWorkflowStore } from '@/store/useWorkflowStore';

/**
 * Mock run: prompt for system.userQuery, walk the graph, show the trace.
 * Human Input nodes suspend the walk on a promise this dialog resolves.
 */
export function MockRunDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const agent = useWorkflowStore((s) => s.currentAgent);
  const [query, setQuery] = useState('');
  const [trace, setTrace] = useState<TraceEntry[] | null>(null);
  const [running, setRunning] = useState(false);

  const [humanPrompt, setHumanPrompt] = useState<string | null>(null);
  const [humanValue, setHumanValue] = useState('');
  const resolveHuman = useRef<((value: string) => void) | null>(null);

  const askHuman = useCallback((prompt: string) => {
    setHumanPrompt(prompt);
    setHumanValue('');
    return new Promise<string>((resolve) => {
      resolveHuman.current = resolve;
    });
  }, []);

  const start = async () => {
    if (!agent) return;
    setRunning(true);
    setTrace(null);
    try {
      setTrace(await runMock(agent, { userQuery: query, onHumanInput: askHuman }));
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Mock Run"
        icon="bi-play-circle"
        footer={
          <>
            <button type="button" className="btn-sm" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn-primary" disabled={running} onClick={start}>
              <i className="bi-play-fill" />
              {running ? 'Running…' : 'Run'}
            </button>
          </>
        }
      >
        <div className="prop-field">
          <label className="prop-label" htmlFor="mock-query">
            system.userQuery
          </label>
          <input
            id="mock-query"
            className="prop-input"
            placeholder="Ask the workflow something…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="prop-hint">
            No LLM, tool or HTTP call is made. Every node returns a placeholder.
          </div>
        </div>

        {trace && (
          <ol className="mt-3 space-y-1.5">
            {trace.map((entry, index) => (
              <li
                key={`${entry.nodeId}-${index}`}
                className="rounded border border-border px-2 py-1.5"
              >
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="count-badge">{index + 1}</span>
                  <strong>{entry.nodeName}</strong>
                  <span className="text-text-muted">{entry.nodeType}</span>
                  <span
                    className={
                      entry.status === 'ok'
                        ? 'ml-auto text-success'
                        : entry.status === 'error'
                          ? 'ml-auto text-danger'
                          : 'ml-auto text-warning'
                    }
                  >
                    {entry.status}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-text-muted">{entry.log}</div>
                {entry.output != null && (
                  <pre className="mt-1 overflow-x-auto rounded bg-bg p-1.5 font-mono text-[10px]">
                    {JSON.stringify(entry.output, null, 2)}
                  </pre>
                )}
                {entry.error && <div className="mt-1 text-[11px] text-danger">{entry.error}</div>}
              </li>
            ))}
          </ol>
        )}
      </Modal>

      <Modal
        open={humanPrompt !== null}
        onClose={() => {
          resolveHuman.current?.('');
          setHumanPrompt(null);
        }}
        title="Human Input Required"
        icon="bi-person-raised-hand"
        width="sm"
        footer={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              resolveHuman.current?.(humanValue);
              setHumanPrompt(null);
            }}
          >
            <i className="bi-send" />
            Submit
          </button>
        }
      >
        <div className="mb-2 text-[12px]">{humanPrompt}</div>
        <input
          autoFocus
          className="prop-input"
          placeholder="Enter your response…"
          value={humanValue}
          onChange={(event) => setHumanValue(event.target.value)}
        />
      </Modal>
    </>
  );
}
