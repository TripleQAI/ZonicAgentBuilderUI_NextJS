'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';

import type { DerivedHandle } from '@/lib/registry/nodeHandles';
import { nodeColor, nodeIcon } from '@/lib/registry/nodePresentation';
import { cn } from '@/lib/utils/cn';
import { useWorkflowStore } from '@/store/useWorkflowStore';

export interface RegistryNodeData extends Record<string, unknown> {
  name: string;
  nodeType: string;
  /** Every handle this node renders, derived from its own config. */
  targets: DerivedHandle[];
  sources: DerivedHandle[];
  /** Sub Flow nodes show whether their child agent resolved. */
  childResolved?: boolean | null;
  childLabel?: string | null;
}

/** Even spacing down an edge: 1/(n+1), 2/(n+1), … so handles never collide. */
function offsetPercent(index: number, total: number): string {
  return `${((index + 1) / (total + 1)) * 100}%`;
}

/**
 * ONE component renders all 17 node types.
 *
 * Label, icon, colour and handles all come from the registry entry plus the
 * node's own config, so adding a node type stays a data-only change — no new
 * component, no new CSS class.
 *
 * The flow reads left to right: inputs enter on the left edge, outputs leave
 * from the right. A node with several outputs — a Rule with one per branch, an
 * Agent with one per handoff — stacks them down the right edge, each labelled.
 */
function RegistryNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as RegistryNodeData;
  const definition = useWorkflowStore((s) => s.getNodeTypeDef(nodeData.nodeType));

  const color = nodeColor(definition);
  const icon = nodeIcon(definition);
  const targets = nodeData.targets ?? [];
  const sources = nodeData.sources ?? [];
  const isMissingChild = nodeData.childResolved === false;
  const manyOutputs = sources.length > 1;

  return (
    <div
      className={cn(
        'rounded-lg border bg-panel px-3 py-2 shadow-[var(--node-shadow)] transition-colors',
        // Room down the right edge for stacked, labelled outputs.
        manyOutputs ? 'min-w-[200px] pr-6' : 'min-w-[180px]',
        selected ? 'border-node-select ring-1 ring-node-select' : 'border-border',
        isMissingChild && 'border-danger',
      )}
      style={manyOutputs ? { minHeight: `${sources.length * 22 + 24}px` } : undefined}
      data-node-id={id}
      data-node-type={nodeData.nodeType}
    >
      {targets.map((handle, index) => (
        <Handle
          key={`t-${handle.id}`}
          id={handle.id}
          type="target"
          position={Position.Left}
          style={
            targets.length > 1 ? { top: offsetPercent(index, targets.length) } : undefined
          }
        />
      ))}

      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] text-white"
          style={{ background: color }}
        >
          <i className={icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-text-primary">
            {nodeData.name}
          </span>
          <span className="block truncate text-[10px] text-text-muted">
            {definition?.label ?? nodeData.nodeType}
          </span>
        </span>
      </div>

      {nodeData.childLabel && (
        <div
          className={cn(
            'mt-1.5 truncate rounded px-1.5 py-0.5 text-[10px]',
            isMissingChild ? 'bg-danger/20 text-danger' : 'bg-success/15 text-success',
          )}
          title={nodeData.childLabel}
        >
          <i className="bi-diagram-3 mr-1" />
          {nodeData.childLabel}
        </div>
      )}

      {sources.map((handle, index) => (
        <Handle
          key={`s-${handle.id}`}
          id={handle.id}
          type="source"
          position={Position.Right}
          title={handle.label}
          className={cn(
            handle.kind === 'handoff' && '!border-accent-2',
            handle.kind === 'branch' && '!border-warning',
          )}
          style={manyOutputs ? { top: offsetPercent(index, sources.length) } : undefined}
        >
          {manyOutputs && handle.label && (
            <span
              className="pointer-events-none absolute right-3 top-1/2 max-w-[110px] -translate-y-1/2
                         truncate text-right text-[9px] text-text-muted"
            >
              {handle.label}
            </span>
          )}
        </Handle>
      ))}
    </div>
  );
}

export const RegistryNode = memo(RegistryNodeComponent);
