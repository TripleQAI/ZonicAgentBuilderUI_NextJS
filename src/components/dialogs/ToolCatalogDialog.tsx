'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { Modal } from '@/components/dialogs/Modal';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { ToolRow } from '@/types/mcp';

/**
 * Browse Catalog — the source's tool_modal.js.
 *
 * The source declared its tabs as a fixed list and treated the "system" tab as
 * "everything", so three of the five tabs could never match. Here the tabs are
 * the tool types the catalogue actually contains, plus All, which means a tab
 * always has something behind it and a new type needs no change.
 */
export function ToolCatalogDialog({
  open,
  nodeId,
  onClose,
}: {
  open: boolean;
  nodeId: string | null;
  onClose: () => void;
}) {
  const catalogue = useQuery({ queryKey: ['tools'], queryFn: api.getTools, enabled: open });
  const updateNodePath = useWorkflowStore((s) => s.updateNodePath);
  const refreshForm = useWorkflowStore((s) => s.refreshForm);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attached, setAttached] = useState<ToolRow[]>([]);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');

  // Read the node's tools when the dialog opens, not once per node: the
  // component stays mounted between openings, so anything derived earlier
  // would still describe the list as it was the first time.
  useEffect(() => {
    if (!open) return;
    const node = useWorkflowStore.getState().currentAgent?.nodes.find((n) => n.id === nodeId);
    const rows = ((node?.config?.tools ?? []) as ToolRow[]) ?? [];

    setAttached(rows);
    // Pre-tick what is already attached, so the dialog shows current state.
    setSelected(new Set(rows.map((tool) => String(tool.name ?? '')).filter(Boolean)));
    setTab('all');
    setQuery('');
  }, [nodeId, open]);

  const { data } = catalogue;
  const tools = useMemo(() => data ?? [], [data]);

  const tabs = useMemo(
    () => ['all', ...Array.from(new Set(tools.map((tool) => tool.toolType).filter(Boolean)))],
    [tools],
  );

  const visible = useMemo(() => {
    const needle = query.toLowerCase();
    return tools.filter((tool) => {
      const inTab = tab === 'all' || tool.toolType === tab;
      const matches =
        !needle ||
        (tool.title || tool.name).toLowerCase().includes(needle) ||
        (tool.description ?? '').toLowerCase().includes(needle);
      return inTab && matches;
    });
  }, [query, tab, tools]);

  const toggle = (name: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const apply = () => {
    if (nodeId == null) return;

    // Keep the rows already attached — they may carry an MCP configuration or
    // keys this dialog knows nothing about — and append only what is new.
    const kept = attached.filter((tool) => selected.has(String(tool.name ?? '')));
    const existing = new Set(kept.map((tool) => String(tool.name ?? '')));
    const added: ToolRow[] = tools
      .filter((tool) => selected.has(tool.name) && !existing.has(tool.name))
      .map((tool) => ({
        name: tool.name,
        title: tool.title,
        type: tool.toolType,
        description: tool.description ?? '',
        config: tool.defaultConfig ?? {},
      }));

    updateNodePath(nodeId, 'config.tools', [...kept, ...added]);
    refreshForm();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select Tools"
      icon="bi-grid"
      width="lg"
      footer={
        <>
          <span className="mr-auto text-[11px] text-text-muted">{selected.size} selected</span>
          <button type="button" className="btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={apply}>
            <i className="bi-check2" />
            Attach
          </button>
        </>
      }
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {tabs.map((name) => (
          <button
            key={name}
            type="button"
            className={cn('btn-sm capitalize', tab === name && 'border-accent text-accent')}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <input
        className="prop-input mb-2"
        placeholder="Search tools…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {catalogue.isLoading && <div className="p-3 text-[12px] text-text-muted">Loading tools…</div>}
      {!catalogue.isLoading && visible.length === 0 && (
        <div className="p-3 text-center text-[11px] text-text-muted">No tools found.</div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {visible.map((tool) => {
          const checked = selected.has(tool.name);
          return (
            <button
              key={tool.name}
              type="button"
              className={cn(
                'rounded border p-2 text-left transition-colors',
                checked ? 'border-accent bg-accent/10' : 'border-border hover:border-accent',
              )}
              onClick={() => toggle(tool.name)}
            >
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={checked} readOnly tabIndex={-1} />
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-text-primary">
                    {tool.title || tool.name}
                  </div>
                  <div className="line-clamp-2 text-[10px] text-text-muted">
                    {tool.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
