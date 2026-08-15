'use client';

import { useController } from 'react-hook-form';

import { FieldShell, type FieldProps } from '@/components/fields/primitives';
import { useWorkflowStore } from '@/store/useWorkflowStore';

/** Sub Flow specific fields: pick the child agent, and show whether it resolved. */

export function AgentSelectorField({ field, name }: FieldProps) {
  const { field: controlled } = useController({ name });
  const allAgents = useWorkflowStore((s) => s.allAgentsById);
  const currentId = useWorkflowStore((s) => s.currentAgent?.agenticWorkflowId);
  const value = (controlled.value as string) ?? '';

  const options = Object.values(allAgents)
    .map((doc) => ({
      id: String(doc.agenticWorkflowId),
      label: String(doc.displayName ?? doc.name ?? doc.agenticWorkflowId),
    }))
    .filter((option) => option.id !== currentId);

  const isUnknown = value !== '' && !options.some((option) => option.id === value);

  return (
    <FieldShell field={field}>
      <select
        id={field.key}
        className="prop-select"
        value={value}
        onChange={(event) => controlled.onChange(event.target.value)}
      >
        <option value="">— Select child workflow —</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
        {/* Keep an id that references a package member we have not loaded, so
            opening the node does not silently clear its child reference. */}
        {isUnknown && <option value={value}>{value} (not loaded)</option>}
      </select>
      <input
        className="prop-input mt-1 font-mono text-[10px]"
        placeholder="agenticWorkflowId"
        value={value}
        onChange={(event) => controlled.onChange(event.target.value)}
      />
    </FieldShell>
  );
}

export function RelationshipStatusField({ field }: FieldProps) {
  const selectedId = useWorkflowStore((s) => s.selectedNodeId);
  const map = useWorkflowStore((s) => s.relationshipMap);

  const entry = [...(map?.resolved ?? []), ...(map?.unresolved ?? [])].find(
    (r) => r.sourceNodeId === selectedId,
  );

  return (
    <FieldShell field={field}>
      {!entry && (
        <div className="rounded-md border border-dashed border-border p-2 text-[11px] text-text-muted">
          Not linked yet — save the workflow to resolve this reference.
        </div>
      )}
      {entry?.isResolved && entry.childAgent && (
        <div className="rounded-md border border-success/40 bg-success/10 p-2 text-[11px] text-success">
          <i className="bi-check-circle mr-1" />
          Resolved to <strong>{entry.childAgent.displayName || entry.childAgent.name}</strong>
          <div className="mt-0.5 text-text-muted">
            {entry.childAgent.nodeCount} nodes · {entry.childAgent.edgeCount} edges
          </div>
        </div>
      )}
      {entry && !entry.isResolved && (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-2 text-[11px] text-danger">
          <i className="bi-exclamation-triangle mr-1" />
          {entry.validationMessage || 'Child workflow not found'}
        </div>
      )}
    </FieldShell>
  );
}
