'use client';

import { useEffect, useState } from 'react';

import { Modal } from '@/components/dialogs/Modal';
import { api } from '@/lib/api/client';
import { toAgentJson } from '@/lib/serialization/agentDocument';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { ValidationResult } from '@/types/agent';

/** Validation results, grouped exactly as the source grouped them. */
export function ValidationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const agent = useWorkflowStore((s) => s.currentAgent);
  const map = useWorkflowStore((s) => s.relationshipMap);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !agent) return;
    setResult(null);
    setError(null);
    api
      .validateWorkflow(toAgentJson(agent))
      .then(setResult)
      .catch((cause) => setError((cause as Error).message));
  }, [agent, open]);

  const missing = map?.unresolved ?? [];
  const unreferenced = map?.unreferencedSubAgents ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Validation Results" icon="bi-shield-check">
      {error && <div className="text-[12px] text-danger">{error}</div>}
      {!result && !error && <div className="text-[12px] text-text-muted">Validating…</div>}

      {result && (
        <div className="space-y-4">
          <div
            className={
              result.valid
                ? 'rounded border border-success/40 bg-success/10 p-2 text-[12px] text-success'
                : 'rounded border border-danger/40 bg-danger/10 p-2 text-[12px] text-danger'
            }
          >
            <i className={result.valid ? 'bi-check-circle mr-1' : 'bi-x-circle mr-1'} />
            {result.valid ? 'Workflow is valid' : `${result.errors.length} error(s) found`}
            <span className="ml-2 text-text-muted">
              {result.node_count} nodes · {result.edge_count} edges
            </span>
          </div>

          <Group title="Current Agent Errors" items={result.errors} tone="danger" />
          <Group title="Current Agent Warnings" items={result.warnings} tone="warning" />
          <Group
            title="Missing Sub Agents"
            items={missing.map(
              (entry) =>
                `${entry.sourceNodeName || entry.sourceNodeId}: ${entry.validationMessage ?? 'unresolved'}`,
            )}
            tone="danger"
          />
          <Group
            title="Unreferenced Sub Agents"
            items={unreferenced.map((a) => a.displayName || a.name || a.agenticWorkflowId)}
            tone="warning"
          />
        </div>
      )}
    </Modal>
  );
}

function Group({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'danger' | 'warning';
}) {
  if (items.length === 0) return null;
  const classes =
    tone === 'danger'
      ? 'border-danger/40 bg-danger/10 text-danger'
      : 'border-warning/40 bg-warning/10 text-warning';
  return (
    <section>
      <div className="prop-section-title">
        {title} ({items.length})
      </div>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={index} className={`rounded border px-2 py-1.5 text-[12px] ${classes}`}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
