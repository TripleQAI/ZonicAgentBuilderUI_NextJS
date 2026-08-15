'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Modal } from '@/components/dialogs/Modal';
import { api } from '@/lib/api/client';

/** Import a package, then show any warnings the server reported. */
export function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (rootAgentId: string) => void | Promise<void>;
}) {
  const [agentFile, setAgentFile] = useState<File | null>(null);
  const [subAgentsFile, setSubAgentsFile] = useState<File | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const doImport = async () => {
    if (!agentFile) {
      toast.error('agent.json is required');
      return;
    }
    setBusy(true);
    try {
      const result = await api.importPackage(agentFile, subAgentsFile);
      toast.success(
        `Imported · ${result.sub_agent_ids.length} sub-agents, ` +
          `${result.relationship_count} relationships`,
      );
      if (result.warnings.length > 0) setWarnings(result.warnings);
      await onImported(result.root_agent_id);
    } catch (error) {
      toast.error(`Import failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Import Agent Package"
        icon="bi-upload"
        width="sm"
        footer={
          <>
            <button type="button" className="btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={busy} onClick={doImport}>
              <i className="bi-upload" />
              {busy ? 'Importing…' : 'Import'}
            </button>
          </>
        }
      >
        <div className="prop-field">
          <label className="prop-label" htmlFor="import-agent">
            agent.json <span className="text-danger">*</span>
          </label>
          <input
            id="import-agent"
            type="file"
            accept=".json"
            className="prop-input"
            onChange={(event) => setAgentFile(event.target.files?.[0] ?? null)}
          />
          <div className="prop-hint">The root agent workflow JSON</div>
        </div>
        <div className="prop-field">
          <label className="prop-label" htmlFor="import-subs">
            sub_agents.json (optional)
          </label>
          <input
            id="import-subs"
            type="file"
            accept=".json"
            className="prop-input"
            onChange={(event) => setSubAgentsFile(event.target.files?.[0] ?? null)}
          />
          <div className="prop-hint">Array of child agent workflow JSONs</div>
        </div>
      </Modal>

      <Modal
        open={warnings !== null}
        onClose={() => setWarnings(null)}
        title="Import Warnings"
        icon="bi-exclamation-triangle"
        width="md"
        footer={
          <button type="button" className="btn-sm" onClick={() => setWarnings(null)}>
            Dismiss
          </button>
        }
      >
        <ul className="space-y-1.5">
          {(warnings ?? []).map((warning, index) => (
            <li
              key={index}
              className="rounded border border-warning/40 bg-warning/10 px-2 py-1.5 text-[12px] text-warning"
            >
              {warning}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
