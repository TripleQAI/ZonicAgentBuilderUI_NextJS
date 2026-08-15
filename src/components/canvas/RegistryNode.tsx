'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';

import { nodeColor, nodeIcon } from '@/lib/registry/nodePresentation';
import { cn } from '@/lib/utils/cn';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { HandleDef } from '@/types/registry';

const POSITION_MAP: Record<string, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

export interface RegistryNodeData extends Record<string, unknown> {
  name: string;
  nodeType: string;
  /** Sub Flow nodes show whether their child agent resolved. */
  childResolved?: boolean | null;
  childLabel?: string | null;
}

/**
 * ONE component renders all 17 node types.
 *
 * Label, icon, colour and handles all come from the registry entry, so adding a
 * node type stays a data-only change — no new component, no new CSS class.
 * This is the single largest reason the canvas rewrite is small.
 */
function RegistryNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as RegistryNodeData;
  const definition = useWorkflowStore((s) => s.getNodeTypeDef(nodeData.nodeType));

  const color = nodeColor(definition);
  const icon = nodeIcon(definition);
  const sources: HandleDef[] = definition?.handles?.sources ?? [];
  const targets: HandleDef[] = definition?.handles?.targets ?? [];
  const isMissingChild = nodeData.childResolved === false;

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-lg border bg-panel px-3 py-2 shadow-[var(--node-shadow)] transition-colors',
        selected ? 'border-node-select ring-1 ring-node-select' : 'border-border',
        isMissingChild && 'border-danger',
      )}
      data-node-id={id}
      data-node-type={nodeData.nodeType}
    >
      {targets.map((handle) => (
        <Handle
          key={`t-${handle.id}`}
          id={handle.id}
          type="target"
          position={POSITION_MAP[handle.position] ?? Position.Top}
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
            isMissingChild
              ? 'bg-danger/20 text-danger'
              : 'bg-success/15 text-success',
          )}
          title={nodeData.childLabel}
        >
          <i className="bi-diagram-3 mr-1" />
          {nodeData.childLabel}
        </div>
      )}

      {/* Rule nodes carry one source handle per branch; the registry says so,
          and each handle is labelled with its branch name. */}
      {sources.map((handle, index) => (
        <Handle
          key={`s-${handle.id}`}
          id={handle.id}
          type="source"
          position={POSITION_MAP[handle.position] ?? Position.Bottom}
          style={
            sources.length > 1
              ? { left: `${((index + 1) / (sources.length + 1)) * 100}%` }
              : undefined
          }
        >
          {sources.length > 1 && handle.label && (
            <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap text-[9px] text-text-muted">
              {handle.label}
            </span>
          )}
        </Handle>
      ))}
    </div>
  );
}

export const RegistryNode = memo(RegistryNodeComponent);
