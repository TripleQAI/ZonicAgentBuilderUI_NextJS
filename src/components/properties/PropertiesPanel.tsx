'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { AgentSettingsPanel } from '@/components/properties/AgentSettingsPanel';
import { SchemaForm } from '@/components/properties/SchemaForm';
import {
  AGENT_SETTINGS_ICON,
  FALLBACK_NODE_COLOR,
  nodeColor,
  nodeIcon,
} from '@/lib/registry/nodePresentation';
import { cn } from '@/lib/utils/cn';
import { selectSelectedNode, useWorkflowStore } from '@/store/useWorkflowStore';

const WIDTH_KEY = 'wb_panel_width';
const MIN_WIDTH = 360;
const MAX_WIDTH = 720;

/**
 * Drive every collapsible section to one state, and report which.
 *
 * Expands while any section is still closed, and only collapses once they are
 * all open. Sections own their own state and are spread across two unrelated
 * component trees — the schema-driven form and the agent settings panel — so
 * the shared control reaches them through the `data-accordion-open` attribute
 * each one already publishes rather than through lifted state.
 *
 * The button previously clicked only the sections reading `true`, which meant
 * that from the default — everything collapsed — it had nothing to click.
 */
export function toggleAccordions(buttons: HTMLButtonElement[]): boolean {
  const target = buttons.some((button) => button.dataset.accordionOpen !== 'true');
  buttons
    .filter((button) => (button.dataset.accordionOpen === 'true') !== target)
    .forEach((button) => button.click());
  return target;
}

/**
 * The right-hand panel.
 *
 * Behaviour carried over from the source: part of the flex layout rather than
 * fixed-position, resizable by dragging its left edge, width persisted in
 * localStorage, independently scrollable, collapse-all, and dimmed in read-only
 * mode.
 */
export function PropertiesPanel() {
  const node = useWorkflowStore(selectSelectedNode);
  const formEpoch = useWorkflowStore((s) => s.formEpoch);
  const isReadOnly = useWorkflowStore((s) => s.isReadOnly);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const updateNode = useWorkflowStore((s) => s.updateNode);
  const definition = useWorkflowStore((s) =>
    node ? s.getNodeTypeDef(node.type) : undefined,
  );

  const [width, setWidth] = useState(MIN_WIDTH);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(WIDTH_KEY);
    if (saved) setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(saved))));
  }, []);

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;

      const onMove = (move: PointerEvent) => {
        // Dragging left widens the panel, so the delta is inverted.
        const next = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth + (startX - move.clientX)),
        );
        setWidth(next);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setWidth((current) => {
          window.localStorage.setItem(WIDTH_KEY, String(current));
          return current;
        });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [width],
  );

  const [expanded, setExpanded] = useState(false);
  /** Agent settings are opt-in: with nothing selected the panel gives its
   *  width back to the canvas until the rail is clicked. Selecting a node
   *  still opens the panel, since that is what selecting a node is for. */
  const [showSettings, setShowSettings] = useState(false);

  const toggleSections = useCallback(() => {
    const buttons = Array.from(
      bodyRef.current?.querySelectorAll<HTMLButtonElement>('[data-accordion-open]') ?? [],
    );
    if (buttons.length > 0) setExpanded(toggleAccordions(buttons));
  }, []);

  if (!node && !showSettings) {
    return (
      <aside className="flex w-9 shrink-0 flex-col items-center gap-2 border-l border-border bg-panel py-2">
        <button
          type="button"
          className="btn-icon readonly-allowed"
          title="Open agent settings"
          aria-label="Open agent settings"
          onClick={() => setShowSettings(true)}
        >
          <i className={AGENT_SETTINGS_ICON} />
        </button>
        <span
          className="select-none text-[10px] uppercase tracking-wider text-text-muted"
          style={{ writingMode: 'vertical-rl' }}
        >
          Agent Settings
        </span>
      </aside>
    );
  }

  return (
    <aside
      className="relative flex shrink-0 flex-col border-l border-border bg-panel"
      style={{ width }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/40"
        onPointerDown={startResize}
        title="Drag to resize"
      />

      <header className="flex items-start gap-2 border-b border-border p-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
          style={{ background: node ? nodeColor(definition) : FALLBACK_NODE_COLOR }}
        >
          <i className={node ? nodeIcon(definition) : AGENT_SETTINGS_ICON} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">
            {node ? node.name : 'Agent Settings'}
          </div>
          <div className="truncate text-[11px] text-text-muted">
            {node ? (definition?.label ?? node.type) : 'No node selected'}
          </div>
          {node && (
            <div className="truncate font-mono text-[10px] text-text-muted">{node.id}</div>
          )}
        </div>
        <button
          type="button"
          className="btn-sm readonly-allowed"
          onClick={toggleSections}
          title={expanded ? 'Collapse all sections' : 'Expand all sections'}
          aria-label={expanded ? 'Collapse all sections' : 'Expand all sections'}
        >
          <i className={expanded ? 'bi-arrows-collapse' : 'bi-arrows-expand'} />
        </button>
        <button
          type="button"
          className="btn-icon readonly-allowed hover:text-danger"
          // Closing a node's properties deselects it, which lands back on the
          // rail; closing the settings themselves just hides the panel.
          onClick={() => (node ? selectNode(null) : setShowSettings(false))}
          title="Close"
          aria-label="Close panel"
        >
          <i className="bi-x-lg" />
        </button>
      </header>

      <div
        ref={bodyRef}
        className={cn('min-h-0 flex-1 overflow-y-auto', isReadOnly && 'is-readonly')}
      >
        {node ? (
          <>
            <div className="border-b border-border px-3 py-3">
              <div className="prop-section-title">Node</div>
              <div className="prop-field">
                <label className="prop-label" htmlFor="node-name">
                  Name
                </label>
                <input
                  id="node-name"
                  className="prop-input"
                  value={node.name}
                  onChange={(event) => updateNode(node.id, { name: event.target.value })}
                />
              </div>
              <div className="prop-field">
                <label className="prop-label" htmlFor="node-description">
                  Description
                </label>
                <textarea
                  id="node-description"
                  rows={2}
                  className="prop-textarea"
                  value={node.description ?? ''}
                  onChange={(event) =>
                    updateNode(node.id, { description: event.target.value })
                  }
                />
              </div>
            </div>
            {/* formEpoch remounts the form when the selection changes, so RHF
                re-seeds its defaults from the newly selected node. */}
            <SchemaForm key={`${node.id}-${formEpoch}`} node={node} />
          </>
        ) : (
          <AgentSettingsPanel />
        )}
      </div>
    </aside>
  );
}
