'use client';

import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';

import { PALETTE_DND_TYPE } from '@/components/canvas/FlowCanvas';
import { api } from '@/lib/api/client';
import { groupNodeTypes } from '@/lib/registry/nodeCategories';
import { nodeColor, nodeIcon } from '@/lib/registry/nodePresentation';
import { useOptions } from '@/lib/registry/optionSets';
import { cn } from '@/lib/utils/cn';
import { useWorkflowStore } from '@/store/useWorkflowStore';

/** A collapsible group: a chevron, the group's name and how many node types it holds. */
function PaletteGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();
  return (
    <section className="mb-2">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 py-1 text-left text-[12px] font-semibold text-text-primary"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((open) => !open)}
      >
        <i className={cn(expanded ? 'bi-chevron-down' : 'bi-chevron-right', 'text-[11px] text-text-muted')} />
        <span>{label}</span>
        <span className="ml-auto inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-border bg-bg px-1.5 text-[11px] font-semibold text-text-muted">
          {count}
        </span>
      </button>
      <div id={bodyId} hidden={!expanded} className="pt-1.5">
        {children}
      </div>
    </section>
  );
}

/**
 * The Node Palette — the drag source for the canvas.
 *
 * The source's left column also carried an agent list, but the header's
 * WorkflowPicker is the same list against the same data, so only one of the two
 * is kept and switching workflows lives entirely in the header.
 */
export function LeftSidebar() {
  const registry = useWorkflowStore((s) => s.nodeRegistry);
  const isReadOnly = useWorkflowStore((s) => s.isReadOnly);
  const categories = useOptions('nodeCategories');

  const [paletteQuery, setPaletteQuery] = useState('');
  const [tab, setTab] = useState<'nodes' | 'tools'>('nodes');

  const tools = useQuery({
    queryKey: ['tools'],
    queryFn: api.getTools,
    enabled: tab === 'tools',
  });

  const groups = useMemo(() => {
    const needle = paletteQuery.toLowerCase();
    const matches = registry.filter(
      (t) =>
        t.label.toLowerCase().includes(needle) || t.type.toLowerCase().includes(needle),
    );
    const grouped = groupNodeTypes(matches, categories);
    // A reserved-but-empty group is worth showing at rest; during a search it
    // would only be a heading over nothing.
    return needle ? grouped.filter((group) => group.types.length > 0) : grouped;
  }, [categories, paletteQuery, registry]);

  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData(PALETTE_DND_TYPE, nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside
      className="flex w-[var(--sidebar-w)] shrink-0 flex-col border-r border-border bg-panel"
      aria-label="Node palette"
    >
      <div className="flex min-h-0 flex-1 flex-col">
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
            groups.map((group) => (
              <PaletteGroup key={group.value} label={group.label} count={group.types.length}>
                {group.types.length === 0 ? (
                  <div className="rounded border border-dashed border-border px-2 py-2 text-center text-[10px] text-text-muted">
                    Nothing here yet
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.types.map((definition) => (
                      <div
                        key={definition.type}
                        draggable={!isReadOnly}
                        onDragStart={(event) => onDragStart(event, definition.type)}
                        title={definition.description || definition.label}
                        aria-disabled={isReadOnly}
                        className={cn(
                          'palette-tile',
                          isReadOnly
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-grab active:cursor-grabbing',
                        )}
                        style={{ '--node-color': nodeColor(definition) } as CSSProperties}
                      >
                        <span className="node-icon-tile h-[34px] w-[34px] text-[17px]">
                          <i className={nodeIcon(definition)} />
                        </span>
                        <span className="min-w-0 break-words">{definition.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </PaletteGroup>
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
