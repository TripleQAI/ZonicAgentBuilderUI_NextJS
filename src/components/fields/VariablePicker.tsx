'use client';

import { useMemo, useState } from 'react';

import { toRows } from '@/lib/agent/flowVariables';
import { cn } from '@/lib/utils/cn';
import { useWorkflowStore } from '@/store/useWorkflowStore';

/**
 * The `{{dot.path}}` token picker.
 *
 * Token sources are derived from the live workflow — flow variables, system
 * parameters, and every upstream node's declared output fields — which is the
 * same set variable_picker.js offered.
 */

interface TokenGroup {
  label: string;
  tokens: { token: string; hint?: string }[];
}

function useTokenGroups(): TokenGroup[] {
  const agent = useWorkflowStore((s) => s.currentAgent);
  const selectedId = useWorkflowStore((s) => s.selectedNodeId);

  return useMemo(() => {
    if (!agent) return [];
    const groups: TokenGroup[] = [];

    groups.push({
      label: 'System',
      tokens: [
        { token: '{{system.userQuery}}', hint: 'The end user input' },
        { token: '{{system.now}}', hint: 'Current timestamp' },
        ...agent.systemParams.map((p) => ({
          token: `{{system.${p.name}}}`,
          hint: p.description,
        })),
      ],
    });

    // Variables are declarations, so the hint can say what each one is.
    const variables = toRows(agent.variables);
    if (variables.length) {
      groups.push({
        label: 'Flow Variables',
        tokens: variables.map((variable) => ({
          token: `{{${variable.name}}}`,
          hint: [variable.type, variable.description].filter(Boolean).join(' — ') || undefined,
        })),
      });
    }

    const upstream = agent.nodes.filter((n) => n.id !== selectedId);
    if (upstream.length) {
      groups.push({
        label: 'Node Outputs',
        tokens: upstream.flatMap((node) => {
          const declared = (node.config?.outputSchema as { name?: string }[] | undefined) ?? [];
          if (Array.isArray(declared) && declared.length) {
            return declared
              .filter((f) => f?.name)
              .map((f) => ({
                token: `{{nodes.${node.name}.outputs.${f.name}}}`,
                hint: node.type,
              }));
          }
          return [{ token: `{{nodes.${node.name}.output.result}}`, hint: node.type }];
        }),
      });
    }

    return groups;
  }, [agent, selectedId]);
}

export function VariablePickerButton({
  onPick,
  label,
}: {
  onPick: (token: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const groups = useTokenGroups();

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        tokens: group.tokens.filter((t) => t.token.toLowerCase().includes(needle)),
      }))
      .filter((group) => group.tokens.length > 0);
  }, [groups, query]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className={cn('btn-sm readonly-allowed', label && 'text-success')}
        title="Insert a variable token"
        onClick={() => setOpen((o) => !o)}
      >
        <i className="bi-braces" />
        {label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border border-border bg-panel p-2 shadow-xl">
            <input
              autoFocus
              className="prop-input mb-2"
              placeholder="Search tokens…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {filtered.length === 0 && (
              <div className="p-2 text-[11px] text-text-muted">No matching tokens</div>
            )}
            {filtered.map((group) => (
              <div key={group.label} className="mb-2">
                <div className="prop-section-title">{group.label}</div>
                {group.tokens.map((entry) => (
                  <button
                    key={entry.token}
                    type="button"
                    className="block w-full truncate rounded px-1.5 py-1 text-left font-mono text-[11px] text-text-primary hover:bg-accent/15 hover:text-accent"
                    title={entry.hint}
                    onClick={() => {
                      onPick(entry.token);
                      setOpen(false);
                    }}
                  >
                    {entry.token}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
