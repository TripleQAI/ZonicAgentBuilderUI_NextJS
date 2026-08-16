'use client';

import { useMemo } from 'react';
import { useController } from 'react-hook-form';

import { FieldShell, type FieldProps } from '@/components/fields/primitives';
import { selectSelectedNode, useWorkflowStore } from '@/store/useWorkflowStore';

/**
 * Handoff targets for an Agent node.
 *
 * Not a plain multi-select, because a handoff is two things at once: an entry
 * in `config.handoffTarget` and a wire on the canvas. Adding one here creates
 * the edge immediately, removing one deletes it, and deleting the wire on the
 * canvas removes the entry — the store keeps both halves in step so they cannot
 * drift apart.
 *
 * The edge is attached to that target's own `handoff-<id>` handle, which is why
 * an Agent node grows one output per target.
 */
export function HandoffTargetsField({ field, name }: FieldProps) {
  const { field: controlled } = useController({ name });
  const node = useWorkflowStore(selectSelectedNode);
  const nodes = useWorkflowStore((s) => s.currentAgent?.nodes);
  const registry = useWorkflowStore((s) => s.nodeRegistry);
  const setHandoffTargets = useWorkflowStore((s) => s.setHandoffTargets);
  const isReadOnly = useWorkflowStore((s) => s.isReadOnly);

  const selected = useMemo(() => {
    const value = controlled.value;
    if (Array.isArray(value)) return value.filter(Boolean) as string[];
    return typeof value === 'string' && value ? [value] : [];
  }, [controlled.value]);

  /** "energy-agent (Sub Flow)" — the node's name and its type's label. */
  const labelFor = (targetId: string) => {
    const target = nodes?.find((n) => n.id === targetId);
    if (!target) return targetId;
    const definition = registry.find((t) => t.type === target.type);
    return `${target.name || target.id} (${definition?.label ?? target.type})`;
  };

  const available = useMemo(
    () =>
      (nodes ?? [])
        .filter((n) => n.id !== node?.id && !selected.includes(n.id))
        .map((n) => ({ id: n.id, label: labelFor(n.id) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, node?.id, selected, registry],
  );

  const commit = (next: string[]) => {
    if (!node) return;
    controlled.onChange(next); // keep the form in step with the store
    // `name` is the field's dot-path from the registry, so the config key is
    // never spelled out here.
    setHandoffTargets(node.id, name, next); // config + canvas edges, together
  };

  return (
    <FieldShell field={field}>
      <div className="space-y-1.5">
        {selected.length === 0 && (
          <div className="rounded border border-dashed border-border p-2 text-[11px] text-text-muted">
            No handoff targets added.
          </div>
        )}

        {selected.map((targetId) => (
          <div
            key={targetId}
            className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5"
          >
            <i className="bi-arrow-return-right text-accent-2" />
            <span className="min-w-0 flex-1 truncate text-[11px]">{labelFor(targetId)}</span>
            <button
              type="button"
              className="btn-icon hover:text-danger"
              title="Remove handoff"
              disabled={isReadOnly}
              onClick={() => commit(selected.filter((id) => id !== targetId))}
            >
              <i className="bi-x-lg" />
            </button>
          </div>
        ))}

        {/* Choosing adds immediately and resets — no separate Add button. */}
        <select
          className="prop-select"
          value=""
          disabled={isReadOnly || available.length === 0}
          onChange={(event) => {
            const chosen = event.target.value;
            if (chosen) commit([...selected, chosen]);
          }}
        >
          <option value="">
            {available.length === 0 ? 'No other nodes to hand off to' : '+ Add handoff target…'}
          </option>
          {available.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </FieldShell>
  );
}
