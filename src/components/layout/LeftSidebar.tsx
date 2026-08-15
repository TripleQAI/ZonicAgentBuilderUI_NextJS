'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type DragEvent } from 'react';

import { PALETTE_DND_TYPE } from '@/components/canvas/FlowCanvas';
import { api } from '@/lib/api/client';
import { nodeColor, nodeIcon } from '@/lib/registry/nodePresentation';
import { cn } from '@/lib/utils/cn';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { AgentSummary } from '@/types/agent';

/** Agent Explorer above, Node Palette below — the source's left column. */
export function LeftSidebar({
  agents,
  onOpenAgent,
}: {
  agents: AgentSummary[];
  onOpenAgent: (id: string, options?: { asRoot?: boolean }) => void;
}) {
  const currentId = useWorkflowStore((s) => s.currentAgent?.agenticWorkflowId);
  const registry = useWorkflowStore((s) => s.nodeRegistry);
  const isReadOnly = useWorkflowStore((s) => s.isReadOnly);

  const [explorerQuery, setExplorerQuery] = useState('');
  const [paletteQuery, setPaletteQuery] = useState('');
  const [tab, setTab] = useState<'nodes' | 'tools'>('nodes');

  const tools = useQuery({
    queryKey: ['tools'],
    queryFn: api.getTools,
    enabled: tab === 'tools',
  });

  const visibleAgents = useMemo(() => {
    const needle = explorerQuery.toLowerCase();
    return agents.filter(
      (a) =>
        a.displayName.toLowerCase().includes(needle) ||
        a.name.toLowerCase().includes(needle),
    );
  }, [agents, explorerQuery]);

  const visibleTypes = useMemo(() => {
    const needle = paletteQuery.toLowerCase();
    return registry.filter(
      (t) =>
        t.label.toLowerCase().includes(needle) || t.type.toLowerCase().includes(needle),
    );
  }, [paletteQuery, registry]);

  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData(PALETTE_DND_TYPE, nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside
      className="flex w-[var(--sidebar-w)] shrink-0 flex-col border-r border-border bg-panel"
      aria-label="Agent explorer and node palette"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="prop-section-title mb-0 border-b border-border px-3 py-2">
          <i className="bi-robot mr-1" />
          Agent Explorer
        </div>
        <div className="p-2">
          <input
            className="prop-input"
            placeholder="Search agents…"
            value={explorerQuery}
            onChange={(event) => setExplorerQuery(event.target.value)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {visibleAgents.length === 0 && (
            <div className="p-2 text-[11px] text-text-muted">No agents loaded</div>
          )}
          {visibleAgents.map((summary) => (
            <button
              key={summary.agenticWorkflowId}
              type="button"
              className={cn(
                'mb-1 block w-full rounded px-2 py-1.5 text-left transition-colors',
                summary.agenticWorkflowId === currentId
                  ? 'bg-accent/15 text-accent'
                  : 'hover:bg-border/60',
              )}
              onClick={() =>
                onOpenAgent(summary.agenticWorkflowId, { asRoot: summary.isRoot })
              }
            >
              <span className="flex items-center gap-1.5">
                <i className={summary.isRoot ? 'bi-house-fill' : 'bi-diagram-2'} />
                <span className="min-w-0 flex-1 truncate text-[12px]">
                  {summary.displayName || summary.name}
                </span>
              </span>
              <span className="text-[10px] text-text-muted">
                {summary.nodeCount} nodes · {summary.edgeCount} edges
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-[1.4] flex-col border-t border-border">
        <div className="prop-section-title mb-0 border-b border-border px-3 py-2">
          <i className="bi-grid mr-1" />
          Node Palette
        </div>

        <div className="flex border-b border-border">
          {(['nodes', 'tools'] as const).map((name) => (
            <button
              key={name}
              type="button"
              className={cn(
                'flex-1 py-1.5 text-[11px] capitalize transition-colors',
                tab === name
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text-muted hover:text-text-primary',
              )}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="p-2">
          <input
            className="prop-input"
            placeholder={tab === 'nodes' ? 'Search nodes…' : 'Search tools…'}
            value={paletteQuery}
            onChange={(event) => setPaletteQuery(event.target.value)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {tab === 'nodes' &&
            visibleTypes.map((definition) => (
              <div
                key={definition.type}
                draggable={!isReadOnly}
                onDragStart={(event) => onDragStart(event, definition.type)}
                title={definition.description || definition.label}
                className={cn(
                  'mb-1 flex items-center gap-2 rounded border border-border px-2 py-1.5',
                  isReadOnly ? 'opacity-50' : 'cursor-grab active:cursor-grabbing hover:border-accent',
                )}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] text-white"
                  style={{ background: nodeColor(definition) }}
                >
                  <i className={nodeIcon(definition)} />
                </span>
                <span className="truncate text-[12px]">{definition.label}</span>
              </div>
            ))}

          {tab === 'tools' && (
            <>
              {tools.isLoading && (
                <div className="p-2 text-[11px] text-text-muted">Loading tools…</div>
              )}
              {(tools.data ?? [])
                .filter((tool) =>
                  (tool.title || tool.name)
                    .toLowerCase()
                    .includes(paletteQuery.toLowerCase()),
                )
                .map((tool) => (
                  <div
                    key={tool.name}
                    className="mb-1 rounded border border-border px-2 py-1.5"
                    title={tool.description}
                  >
                    <div className="flex items-center gap-2">
                      <i className="bi-wrench-adjustable text-accent" />
                      <span className="min-w-0 flex-1 truncate text-[12px]">
                        {tool.title || tool.name}
                      </span>
                      <span className="count-badge">{tool.toolType}</span>
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
