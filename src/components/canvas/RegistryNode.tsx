'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, type CSSProperties } from 'react';

import type { DerivedHandle } from '@/lib/registry/nodeHandles';
import { HANDLE_COLORS, nodeColor, nodeIcon } from '@/lib/registry/nodePresentation';
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

/** The header: padding above the icon tile, and the tile's size (.node-card, .node-icon-tile). */
const CARD_PADDING_TOP = 10;
const ICON_SIZE = 32;
/** Space between the header and the first output row, and each row's height. */
const ROWS_GAP = 6;
const OUTPUT_ROW_HEIGHT = 20;

/** Where a handle sits on a node with output rows: beside the header, or beside its row. */
const headerHandleTop = `${CARD_PADDING_TOP + ICON_SIZE / 2}px`;
const outputRowTop = (index: number): string =>
  `${CARD_PADDING_TOP + ICON_SIZE + ROWS_GAP + index * OUTPUT_ROW_HEIGHT + OUTPUT_ROW_HEIGHT / 2}px`;

/** Even spacing down an edge: 1/(n+1), 2/(n+1), … so handles never collide. */
function offsetPercent(index: number, total: number): string {
  return `${((index + 1) / (total + 1)) * 100}%`;
}

/**
 * ONE component renders all 17 node types.
 *
 * Label, icon, colour and handles all come from the registry entry plus the
 * node's own config, so adding a node type stays a data-only change — no new
 * component, no new CSS class. The card is tinted with the node type's colour,
 * after the Strands Visual Builder.
 *
 * The flow reads left to right: inputs enter on the left edge, outputs leave
 * from the right. A node with several outputs — a Rule with one per branch, an
 * Agent with one per handoff — lists them as bulleted rows, each with its
 * handle beside it; a plain output among them stays beside the header.
 */
function RegistryNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as RegistryNodeData;
  const definition = useWorkflowStore((s) => s.getNodeTypeDef(nodeData.nodeType));

  const color = nodeColor(definition);
  const icon = nodeIcon(definition);
  const typeLabel = definition?.label ?? nodeData.nodeType;
  const targets = nodeData.targets ?? [];
  const sources = nodeData.sources ?? [];
  const isMissingChild = nodeData.childResolved === false;
  const manyOutputs = sources.length > 1;
  const plain = sources.filter((handle) => handle.kind === 'default');
  const headerSource = manyOutputs && plain.length === 1 ? plain[0] : undefined;
  const rows = manyOutputs ? sources.filter((handle) => handle !== headerSource) : [];
  // The type label only adds something when the node has a name of its own.
  const showType = typeLabel !== '' && typeLabel !== nodeData.name;

  return (
    <div
      className={cn(
        'node-card relative',
        selected && 'is-selected',
        isMissingChild && 'is-missing-child',
      )}
      style={{ '--node-color': color } as CSSProperties}
      data-node-id={id}
      data-node-type={nodeData.nodeType}
    >
      {targets.map((handle, index) => (
        <Handle
          key={`t-${handle.id}`}
          id={handle.id}
          type="target"
          position={Position.Left}
          style={{
            borderColor: HANDLE_COLORS[handle.kind],
            ...(targets.length > 1
              ? { top: offsetPercent(index, targets.length) }
              : manyOutputs
                ? { top: headerHandleTop }
                : {}),
          }}
        />
      ))}

      <div className="flex items-center gap-2.5">
        <span
          className="node-icon-tile"
          style={{ width: ICON_SIZE, height: ICON_SIZE, fontSize: ICON_SIZE / 2 }}
        >
          <i className={icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-text-primary">
            {nodeData.name}
          </span>
          {showType && (
            <span className="block truncate text-[11px] text-text-muted">{typeLabel}</span>
          )}
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

      {rows.length > 0 && (
        <ul className="m-0 list-none p-0" style={{ marginTop: ROWS_GAP, marginLeft: ICON_SIZE + 8 }}>
          {rows.map((handle) => (
            <li
              key={`row-${handle.id}`}
              className="flex max-w-[160px] items-center gap-1.5 truncate text-[11px] text-text-muted"
              style={{ height: OUTPUT_ROW_HEIGHT }}
              title={handle.label}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: HANDLE_COLORS[handle.kind] }}
              />
              <span className="truncate">{handle.label || handle.id}</span>
            </li>
          ))}
        </ul>
      )}

      {sources.map((handle) => (
        <Handle
          key={`s-${handle.id}`}
          id={handle.id}
          type="source"
          position={Position.Right}
          title={handle.label}
          style={{
            borderColor: HANDLE_COLORS[handle.kind],
            ...(handle === headerSource
              ? { top: headerHandleTop }
              : manyOutputs
                ? { top: outputRowTop(rows.indexOf(handle)) }
                : {}),
          }}
        />
      ))}
    </div>
  );
}

export const RegistryNode = memo(RegistryNodeComponent);
