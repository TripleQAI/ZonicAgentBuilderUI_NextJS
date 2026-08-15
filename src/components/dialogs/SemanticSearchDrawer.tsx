'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Modal } from '@/components/dialogs/Modal';
import { api } from '@/lib/api/client';
import { toAgentJson } from '@/lib/serialization/agentDocument';
import { useWorkflowStore } from '@/store/useWorkflowStore';

const DOMAINS = [
  { value: '', label: '— Select domain —' },
  { value: 'energy', label: 'Energy' },
  { value: 'facilities', label: 'Facilities' },
  { value: 'risk', label: 'Risk' },
];

/**
 * Semantic search configuration.
 *
 * Apply follows the source's two-step flow: save the workflow first, then ask
 * the server to embed it — the vector must be generated from persisted state,
 * not from unsaved edits.
 */
export function SemanticSearchDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const agent = useWorkflowStore((s) => s.currentAgent);
  const patchAgent = useWorkflowStore((s) => s.patchAgent);
  const markClean = useWorkflowStore((s) => s.markClean);

  const [enabled, setEnabled] = useState(false);
  const [domain, setDomain] = useState('');
  const [keywords, setKeywords] = useState('');
  const [useCases, setUseCases] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'indexing'>('idle');

  useEffect(() => {
    if (!open || !agent) return;
    setEnabled(agent.semanticSearchEnabled);
    setDomain(agent.semanticDomain);
    setKeywords(agent.semanticKeywords);
    setUseCases(agent.semanticUseCases);
  }, [agent, open]);

  const apply = async () => {
    if (!agent) return;
    patchAgent({
      semanticSearchEnabled: enabled,
      semanticDomain: domain,
      semanticKeywords: keywords,
      semanticUseCases: useCases,
    });

    if (!enabled) {
      toast.info('Semantic search disabled. Save the workflow to persist the change.');
      onClose();
      return;
    }

    try {
      setStatus('saving');
      const next = {
        ...toAgentJson(agent),
        semanticSearchEnabled: true,
        semanticDomain: domain,
        semanticKeywords: keywords,
        semanticUseCases: useCases,
      };
      await api.saveAgent(agent.agenticWorkflowId, next);
      markClean();

      setStatus('indexing');
      const result = await api.embedAgent(agent.agenticWorkflowId);
      toast.success(`Semantic index created (${result.dimensions} dimensions)`);
      onClose();
    } catch (error) {
      toast.error(`Indexing failed: ${(error as Error).message}`);
    } finally {
      setStatus('idle');
    }
  };

  const busyLabel =
    status === 'saving' ? 'Saving…' : status === 'indexing' ? 'Indexing…' : 'Apply';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Semantic Search"
      icon="bi-stars"
      side
      footer={
        <>
          <span className="mr-auto text-[11px] text-text-muted">
            Applying saves the workflow first.
          </span>
          <button type="button" className="btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={status !== 'idle'}
            onClick={apply}
          >
            <i className="bi-check-lg" />
            {busyLabel}
          </button>
        </>
      }
    >
      <label className="mb-4 flex items-start gap-3 rounded border border-border p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span>
          <span className="block text-[12px] font-semibold">
            Enable Semantic Search Index
          </span>
          <span className="prop-hint">
            Index this workflow so it can be matched automatically from user input.
          </span>
        </span>
      </label>

      {enabled ? (
        <div>
          <div className="prop-section-title">Configuration</div>

          <div className="prop-field">
            <label className="prop-label" htmlFor="ss-domain">
              Domain
            </label>
            <select
              id="ss-domain"
              className="prop-select"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
            >
              {DOMAINS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="prop-hint">
              Primary domain scopes search results to relevant workflows.
            </div>
          </div>

          <div className="prop-field">
            <label className="prop-label" htmlFor="ss-keywords">
              Keywords / Tags
            </label>
            <textarea
              id="ss-keywords"
              rows={3}
              className="prop-textarea"
              placeholder="energy monitoring, risk analysis, facility management…"
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
            />
            <div className="prop-hint">
              Comma-separated keywords that describe what this workflow handles.
            </div>
          </div>

          <div className="prop-field">
            <label className="prop-label" htmlFor="ss-usecases">
              Use Cases
            </label>
            <textarea
              id="ss-usecases"
              rows={5}
              className="prop-textarea"
              placeholder="This workflow handles queries about… Use it when a user asks about…"
              value={useCases}
              onChange={(event) => setUseCases(event.target.value)}
            />
            <div className="prop-hint">
              The most impactful field for semantic accuracy.
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded border border-dashed border-border p-6 text-center">
          <i className="bi-stars text-3xl text-accent-2 opacity-50" />
          <div className="mt-2 text-[13px] font-semibold">Semantic Search is disabled</div>
          <p className="prop-hint mx-auto mt-1 max-w-[260px]">
            Enable the toggle above to configure how this workflow is indexed for
            AI-powered agent matching.
          </p>
        </div>
      )}
    </Modal>
  );
}
