'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Modal } from '@/components/dialogs/Modal';
import { toAgentJson } from '@/lib/serialization/agentDocument';
import { cn } from '@/lib/utils/cn';
import { useWorkflowStore } from '@/store/useWorkflowStore';

type Tab = 'agent' | 'nodes' | 'edges' | 'relmap';

const TABS: { id: Tab; label: string }[] = [
  { id: 'agent', label: 'Current Agent' },
  { id: 'nodes', label: 'Nodes' },
  { id: 'edges', label: 'Edges' },
  { id: 'relmap', label: 'Rel Map' },
];

/** Four tabs, an edit mode that writes back, and copy — as the source had. */
export function JsonViewerDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const agent = useWorkflowStore((s) => s.currentAgent);
  const map = useWorkflowStore((s) => s.relationshipMap);
  const patchAgent = useWorkflowStore((s) => s.patchAgent);

  const [tab, setTab] = useState<Tab>('agent');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo(() => {
    if (!agent) return null;
    if (tab === 'agent') return toAgentJson(agent);
    if (tab === 'nodes') return agent.nodes;
    if (tab === 'edges') return agent.edges;
    return map;
  }, [agent, map, tab]);

  const text = useMemo(() => JSON.stringify(payload ?? null, null, 2), [payload]);

  const applyEdit = () => {
    try {
      const parsed = JSON.parse(draft);
      if (tab === 'nodes') patchAgent({ nodes: parsed });
      else if (tab === 'edges') patchAgent({ edges: parsed });
      else if (tab === 'agent') {
        // Replacing the whole document also replaces rawJson, so unknown keys
        // the user pasted are preserved on the next save.
        patchAgent({
          nodes: parsed.nodes ?? [],
          edges: parsed.edges ?? [],
          variables: parsed.variables ?? {},
          interface: parsed.interface ?? {},
          skills: parsed.skills ?? [],
          publishChannels: parsed.publishChannels ?? [],
          security: parsed.security ?? {},
          displayName: parsed.displayName ?? '',
          name: parsed.name ?? '',
          description: parsed.description ?? '',
          rawJson: parsed,
        });
      }
      setEditing(false);
      setError(null);
      toast.success('JSON applied to the editor');
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="JSON Viewer"
      icon="bi-braces"
      side
      footer={
        editing ? (
          <>
            <button type="button" className="btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={applyEdit}>
              <i className="bi-check-lg" />
              Apply
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn-sm"
              onClick={() => navigator.clipboard.writeText(text).then(() => toast.success('Copied'))}
            >
              <i className="bi-clipboard" />
              Copy
            </button>
            {tab !== 'relmap' && (
              <button
                type="button"
                className="btn-sm"
                onClick={() => {
                  setDraft(text);
                  setEditing(true);
                  setError(null);
                }}
              >
                <i className="bi-pencil" />
                Edit
              </button>
            )}
          </>
        )
      }
    >
      <div className="mb-2 flex gap-1 border-b border-border">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={cn(
              'px-2 py-1 text-[11px] transition-colors',
              tab === entry.id
                ? 'border-b-2 border-accent text-accent'
                : 'text-text-muted hover:text-text-primary',
            )}
            onClick={() => {
              setTab(entry.id);
              setEditing(false);
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {editing ? (
        <>
          <textarea
            className="prop-textarea h-[60vh] font-mono text-[11px]"
            spellCheck={false}
            style={{ borderColor: error ? 'var(--danger)' : undefined }}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {error && <div className="prop-hint text-danger">{error}</div>}
        </>
      ) : (
        <pre className="overflow-x-auto rounded bg-bg p-2 font-mono text-[11px] leading-relaxed">
          {text}
        </pre>
      )}
    </Modal>
  );
}
