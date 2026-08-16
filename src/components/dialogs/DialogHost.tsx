'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { FlowVariablesDrawer } from '@/components/dialogs/FlowVariablesDrawer';
import { ImportDialog } from '@/components/dialogs/ImportDialog';
import { JsonViewerDrawer } from '@/components/dialogs/JsonViewerDrawer';
import { KeyValueDrawer } from '@/components/dialogs/KeyValueDrawer';
import { MockRunDialog } from '@/components/dialogs/MockRunDialog';
import { Modal } from '@/components/dialogs/Modal';
import { RelationshipMapDialog } from '@/components/dialogs/RelationshipMapDialog';
import { SemanticSearchDrawer } from '@/components/dialogs/SemanticSearchDrawer';
import { ValidationDialog } from '@/components/dialogs/ValidationDialog';
import { api } from '@/lib/api/client';
import { toAgentJson } from '@/lib/serialization/agentDocument';
import { downloadJson } from '@/lib/utils/download';
import { useWorkflowStore } from '@/store/useWorkflowStore';

export type DialogName =
  | 'import'
  | 'json-viewer'
  | 'relationship-map'
  | 'validation'
  | 'mock-run'
  | 'semantic'
  | 'snapshot'
  | 'flow-variables'
  | 'system-params'
  | 'export-agent'
  | 'export-package'
  | 'export-debug';

/**
 * Routes the toolbar's dialog names to their surfaces.
 *
 * The three export actions are not dialogs — they fetch and download — so they
 * are handled here rather than each button knowing how to call the API.
 */
export function DialogHost({
  open,
  onClose,
  onImported,
}: {
  open: DialogName | null;
  onClose: () => void;
  onImported: (rootAgentId: string) => void | Promise<void>;
}) {
  const agent = useWorkflowStore((s) => s.currentAgent);
  const patchAgent = useWorkflowStore((s) => s.patchAgent);
  const [snapshotComment, setSnapshotComment] = useState('');
  const [busy, setBusy] = useState(false);

  // Exports run immediately and close.
  if (open?.startsWith('export-') && agent) {
    const id = agent.agenticWorkflowId;
    const run = async () => {
      try {
        if (open === 'export-agent') {
          downloadJson(await api.exportAgent(id), `${agent.name || 'agent'}.json`);
        } else if (open === 'export-package') {
          downloadJson(await api.exportPackage(id), `${agent.name || 'agent'}_package.json`);
        } else {
          downloadJson(await api.exportDebug(id), `${agent.name || 'agent'}_debug.json`);
        }
        toast.success('Export downloaded');
      } catch (error) {
        toast.error(`Export failed: ${(error as Error).message}`);
      }
      onClose();
    };
    void run();
    return null;
  }

  return (
    <>
      <ImportDialog open={open === 'import'} onClose={onClose} onImported={onImported} />
      <JsonViewerDrawer open={open === 'json-viewer'} onClose={onClose} />
      <RelationshipMapDialog open={open === 'relationship-map'} onClose={onClose} />
      <ValidationDialog open={open === 'validation'} onClose={onClose} />
      <MockRunDialog open={open === 'mock-run'} onClose={onClose} />
      <SemanticSearchDrawer open={open === 'semantic'} onClose={onClose} />

      <FlowVariablesDrawer
        open={open === 'flow-variables'}
        onClose={onClose}
        value={(agent?.variables ?? {}) as Record<string, unknown>}
        onSave={(next) => patchAgent({ variables: next })}
      />

      <KeyValueDrawer
        open={open === 'system-params'}
        onClose={onClose}
        title="System Parameters"
        icon="bi-gear"
        description="Reference them in any node field as {{system.paramName}}."
        value={Object.fromEntries(
          (agent?.systemParams ?? []).map((p) => [p.name, p.value ?? '']),
        )}
        onSave={(next) =>
          patchAgent({
            systemParams: Object.entries(next).map(([name, value]) => ({
              name,
              value: String(value ?? ''),
            })),
          })
        }
      />

      <Modal
        open={open === 'snapshot'}
        onClose={onClose}
        title="Create Snapshot"
        icon="bi-camera"
        width="sm"
        footer={
          <>
            <button type="button" className="btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !agent}
              onClick={async () => {
                if (!agent) return;
                setBusy(true);
                try {
                  await api.createSnapshot(agent.agenticWorkflowId, snapshotComment);
                  toast.success('Snapshot created');
                  setSnapshotComment('');
                  onClose();
                } catch (error) {
                  toast.error(`Snapshot failed: ${(error as Error).message}`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <i className="bi-camera" />
              Create Snapshot
            </button>
          </>
        }
      >
        <label className="prop-label" htmlFor="snapshot-comment">
          Comment (optional)
        </label>
        <textarea
          id="snapshot-comment"
          rows={3}
          className="prop-textarea"
          placeholder="Describe this checkpoint…"
          value={snapshotComment}
          onChange={(event) => setSnapshotComment(event.target.value)}
        />
        <div className="prop-hint">
          The snapshot is taken from the saved state on the server, not from unsaved
          edits in this tab.
        </div>
      </Modal>
    </>
  );
}

/** Shared by the validation and mock-run dialogs. */
export function currentDocument() {
  const agent = useWorkflowStore.getState().currentAgent;
  return agent ? toAgentJson(agent) : null;
}
