'use client';

import { useState } from 'react';

import { useOptions } from '@/lib/registry/optionSets';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { AgentDraft } from '@/types/agent';

/** Shown when nothing is selected — the workflow's own settings. */

const FLAGS: { key: keyof AgentDraft; label: string }[] = [
  { key: 'isDisabled', label: 'Disabled' },
  { key: 'isAvailableForMigration', label: 'Available for Migration' },
  { key: 'enableForAutoInvoke', label: 'Enable Auto-Invoke' },
  { key: 'includeThoughts', label: 'Include Thoughts' },
];

const JSON_SECTIONS: { key: keyof AgentDraft; label: string }[] = [
  { key: 'variables', label: 'Variables' },
  { key: 'interface', label: 'Interface' },
  { key: 'skills', label: 'Skills' },
  { key: 'publishChannels', label: 'Publish Channels' },
  { key: 'security', label: 'Security' },
];

function JsonAccordion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (parsed: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [invalid, setInvalid] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        type="button"
        className="readonly-allowed flex w-full items-center justify-between px-3 py-2.5"
        onClick={() => setOpen((o) => !o)}
        data-accordion-open={open}
      >
        <span className="prop-section-title mb-0">{label}</span>
        <i className={`bi-chevron-down text-[10px] ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3">
          <textarea
            rows={6}
            spellCheck={false}
            className="prop-textarea font-mono text-[10px]"
            style={{ borderColor: invalid ? 'var(--danger)' : undefined }}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => {
              try {
                onChange(JSON.parse(text || '{}'));
                setInvalid(false);
              } catch {
                setInvalid(true);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

export function AgentSettingsPanel() {
  const agent = useWorkflowStore((s) => s.currentAgent);
  const patchAgent = useWorkflowStore((s) => s.patchAgent);
  const invocationTypes = useOptions('invocationTypes');

  if (!agent) {
    return (
      <div className="p-3 text-[12px] text-text-muted">
        No agent loaded. Import a package or create a new workflow.
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-border px-3 py-3">
        <div className="prop-section-title">Identity</div>

        <div className="prop-field">
          <label className="prop-label">Workflow ID</label>
          <button
            type="button"
            className="prop-input readonly-allowed break-all text-left font-mono text-[10px]"
            title="Click to copy"
            onClick={() => navigator.clipboard.writeText(agent.agenticWorkflowId)}
          >
            {agent.agenticWorkflowId}
          </button>
        </div>

        {(
          [
            ['displayName', 'Display Name'],
            ['name', 'Internal Name'],
            ['bpc', 'BPC'],
          ] as const
        ).map(([key, label]) => (
          <div className="prop-field" key={key}>
            <label className="prop-label" htmlFor={`agent-${key}`}>
              {label}
            </label>
            <input
              id={`agent-${key}`}
              className="prop-input"
              value={agent[key]}
              onChange={(event) => patchAgent({ [key]: event.target.value })}
            />
          </div>
        ))}

        <div className="prop-field">
          <label className="prop-label" htmlFor="agent-description">
            Description
          </label>
          <textarea
            id="agent-description"
            rows={3}
            className="prop-textarea"
            value={agent.description}
            onChange={(event) => patchAgent({ description: event.target.value })}
          />
        </div>

        <div className="prop-field">
          <label className="prop-label" htmlFor="agent-invocation">
            Invocation Type
          </label>
          <select
            id="agent-invocation"
            className="prop-select"
            value={agent.invocationType}
            onChange={(event) => patchAgent({ invocationType: event.target.value })}
          >
            <option value="">— Select —</option>
            {invocationTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="prop-field">
          <label className="prop-label" htmlFor="agent-editas">
            Edit As
          </label>
          <input
            id="agent-editas"
            className="prop-input"
            value={agent.editAs}
            onChange={(event) => patchAgent({ editAs: event.target.value })}
          />
        </div>
      </div>

      <div className="border-b border-border px-3 py-3">
        <div className="prop-section-title">Configuration</div>
        {FLAGS.map(({ key, label }) => (
          <label
            key={String(key)}
            className="mb-2 flex cursor-pointer items-center gap-2 text-[12px]"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={Boolean(agent[key])}
              onChange={(event) => patchAgent({ [key]: event.target.checked })}
            />
            {label}
          </label>
        ))}
        <div className="mt-2 flex gap-2">
          <span className="count-badge">{agent.nodes.length} nodes</span>
          <span className="count-badge">{agent.edges.length} edges</span>
        </div>
      </div>

      {JSON_SECTIONS.map(({ key, label }) => (
        <JsonAccordion
          key={String(key)}
          label={label}
          value={agent[key]}
          onChange={(parsed) => patchAgent({ [key]: parsed })}
        />
      ))}
    </div>
  );
}
