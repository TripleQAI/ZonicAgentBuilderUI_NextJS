'use client';

import Link from 'next/link';
import { useState, type MouseEvent } from 'react';

import { UserMenu } from '@/components/auth/UserMenu';
import { BrandMark } from '@/components/brand/BrandMark';
import { WorkflowPicker } from '@/components/explorer/WorkflowPicker';
import type { DialogName } from '@/components/dialogs/DialogHost';
import { cn } from '@/lib/utils/cn';
import { messages } from '@/lib/i18n/messages';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { AgentSummary } from '@/types/agent';

/** The toolbar, declared as data so the order and icons live in one place. */
const TOOLBAR: { id: DialogName; icon: string; title: string }[] = [
  { id: 'flow-variables', icon: 'bi-database', title: 'Flow Variables' },
  { id: 'system-params', icon: 'bi-gear', title: 'System Parameters' },
  { id: 'json-viewer', icon: 'bi-braces', title: 'View JSON' },
  { id: 'relationship-map', icon: 'bi-diagram-3', title: 'Relationship Map' },
  { id: 'validation', icon: 'bi-shield-check', title: 'Validate' },
  { id: 'mock-run', icon: 'bi-play-circle', title: 'Run Mock' },
  { id: 'semantic', icon: 'bi-stars', title: 'Semantic Search Config' },
  { id: 'snapshot', icon: 'bi-camera', title: 'Create Snapshot' },
];

const EXPORTS: { id: DialogName; icon: string; title: string }[] = [
  { id: 'export-agent', icon: 'bi-box-arrow-down', title: 'Export Agent' },
  { id: 'export-package', icon: 'bi-archive', title: 'Export Package' },
  { id: 'export-debug', icon: 'bi-bug', title: 'Export Debug Package' },
];

export function AppHeader({
  onOpenDialog,
  onSave,
  agents,
  onOpenAgent,
}: {
  onOpenDialog: (dialog: DialogName) => void;
  onSave: () => void;
  agents: AgentSummary[];
  onOpenAgent: (id: string, options?: { asRoot?: boolean }) => void;
}) {
  const agent = useWorkflowStore((s) => s.currentAgent);
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const rootId = useWorkflowStore((s) => s.rootAgenticWorkflowId);
  const patchAgent = useWorkflowStore((s) => s.patchAgent);
  const [saving, setSaving] = useState(false);

  const nodeCount = agent?.nodes.length ?? 0;
  const edgeCount = agent?.edges.length ?? 0;
  const isChild = Boolean(agent && rootId && agent.agenticWorkflowId !== rootId);
  const rootName =
    agents.find((a) => a.agenticWorkflowId === rootId)?.displayName ?? 'Root';

  /** Leaving for the workflow list asks first when there are unsaved changes. */
  const confirmLeave = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isDirty && !window.confirm('This workflow has unsaved changes. Leave without saving?'))
      event.preventDefault();
  };

  return (
    <header className="flex h-[var(--header-h)] shrink-0 items-center gap-3 border-b border-border bg-panel px-3">
      <BrandMark onClick={confirmLeave} />

      {/* One click back to the list of all workflows. */}
      <Link
        href="/workflows"
        onClick={confirmLeave}
        className="btn-sm shrink-0"
        title="Back to all workflows"
        aria-label="Back to all workflows"
      >
        <i className="bi-arrow-left" aria-hidden />
        <i className="bi-grid-3x3-gap" aria-hidden />
        Workflows
      </Link>
      <span className="h-6 w-px shrink-0 bg-border" aria-hidden />

      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <input
            className="w-52 truncate border-none bg-transparent text-[13px] font-semibold text-text-primary outline-none"
            value={agent?.displayName ?? ''}
            placeholder="Untitled"
            spellCheck={false}
            onChange={(event) => patchAgent({ displayName: event.target.value })}
            aria-label={messages.WORKFLOW_BUILDER}
          />
          <WorkflowPicker agents={agents} onOpenAgent={onOpenAgent} />
        </div>
        {agent && (
          <button
            type="button"
            className="block max-w-[220px] truncate font-mono text-[10px] text-text-muted"
            title="Click to copy"
            onClick={() => navigator.clipboard.writeText(agent.agenticWorkflowId)}
          >
            {agent.agenticWorkflowId}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        <span className="count-badge">{nodeCount} nodes</span>
        <span className="count-badge">{edgeCount} edges</span>
        {isDirty && (
          <span
            className="h-2 w-2 rounded-full bg-warning"
            title="Unsaved changes"
            aria-label="Unsaved changes"
          />
        )}
      </div>

      {isChild && (
        <nav className="truncate text-[11px] text-text-muted" aria-label="Breadcrumb">
          <button
            type="button"
            className="hover:text-accent"
            onClick={() => rootId && onOpenAgent(rootId, { asRoot: true })}
          >
            {rootName}
          </button>
          <span className="mx-1">›</span>
          <span className="text-text-primary">{agent?.displayName}</span>
        </nav>
      )}

      <div className="ml-auto flex items-center gap-1">
        {TOOLBAR.map((item) => (
          <button
            key={item.id}
            type="button"
            className="btn-icon"
            title={item.title}
            onClick={() => onOpenDialog(item.id)}
          >
            <i className={item.icon} />
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-border" />

        <button
          type="button"
          className={cn('btn-sm', isDirty && 'border-warning text-warning')}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave();
            } finally {
              setSaving(false);
            }
          }}
        >
          <i className="bi-floppy" />
          {saving ? 'Saving…' : 'Save'}
        </button>

        <button
          type="button"
          className="btn-sm"
          onClick={() => onOpenDialog('import')}
          title="Import Package"
        >
          <i className="bi-upload" />
          Import
        </button>

        {EXPORTS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="btn-icon"
            title={item.title}
            onClick={() => onOpenDialog(item.id)}
          >
            <i className={item.icon} />
          </button>
        ))}
      </div>

      <UserMenu />
    </header>
  );
}
