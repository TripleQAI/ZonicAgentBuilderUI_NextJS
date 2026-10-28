'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, type CSSProperties } from 'react';

import { CONTAINER_HEADER_HEIGHT } from '@/components/canvas/containerLayout';
import type { RegistryNodeData } from '@/components/canvas/RegistryNode';
import { HANDLE_COLORS, nodeColor, nodeIcon } from '@/lib/registry/nodePresentation';
import { cn } from '@/lib/utils/cn';
import { useWorkflowStore } from '@/store/useWorkflowStore';

export interface ContainerNodeData extends RegistryNodeData {
  memberCount: number;
  /** The member a run starts at (the entry point, else the first member). */
  entryName?: string;
}

/** The handles sit level with the header, as on the other cards. */
const HANDLE_TOP = `${CONTAINER_HEADER_HEIGHT / 2}px`;

/**
 * A container node (`layout.kind: "container"`), such as a swarm: a frame whose
 * members are drawn inside it. The header names it and shows the member count
 * and the entry member; one input on the left and one output on the right, level
 * with the header, connect it to the rest of the workflow. Members have no
 * connections: they hand off to each other at run time. The frame's size comes
 * from its members (canvas/containerLayout.ts).
 */
function ContainerNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as ContainerNodeData;
  const definition = useWorkflowStore((s) => s.getNodeTypeDef(nodeData.nodeType));
  const [target] = nodeData.targets ?? [];
  const [source] = nodeData.sources ?? [];
  const typeLabel = definition?.label ?? nodeData.nodeType;
  const count = nodeData.memberCount;

  return (
    <div
      className={cn('container-frame', selected && 'is-selected')}
      style={{ '--node-color': nodeColor(definition) } as CSSProperties}
      data-node-id={id}
      data-node-type={nodeData.nodeType}
    >
      {target && (
        <Handle
          id={target.id}
          type="target"
          position={Position.Left}
          style={{ borderColor: HANDLE_COLORS[target.kind], top: HANDLE_TOP }}
        />
      )}
      <div className="container-header" style={{ height: CONTAINER_HEADER_HEIGHT }}>
        <span className="node-icon-tile" style={{ width: 32, height: 32, fontSize: 16 }}>
          <i className={nodeIcon(definition)} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-text-primary">
            {nodeData.name}
          </span>
          <span className="block truncate text-[11px] text-text-muted">
            {typeLabel} · {count} {count === 1 ? 'member' : 'members'}
            {nodeData.entryName ? ` · starts at ${nodeData.entryName}` : ''}
          </span>
        </span>
      </div>
      {count === 0 && (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-[11px] text-text-muted">
          Drop Agent or LLM nodes here to add them to the swarm
        </div>
      )}
      {source && (
        <Handle
          id={source.id}
          type="source"
          position={Position.Right}
          style={{ borderColor: HANDLE_COLORS[source.kind], top: HANDLE_TOP }}
        />
      )}
    </div>
  );
}

export const ContainerNode = memo(ContainerNodeComponent);
