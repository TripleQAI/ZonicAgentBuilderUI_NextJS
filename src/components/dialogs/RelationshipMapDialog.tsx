'use client';

import { Modal } from '@/components/dialogs/Modal';
import { useWorkflowStore } from '@/store/useWorkflowStore';

/** Parent-to-child map, straight from the server's single read. */
export function RelationshipMapDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const map = useWorkflowStore((s) => s.relationshipMap);

  return (
    <Modal open={open} onClose={onClose} title="Relationship Map" icon="bi-diagram-3" width="lg">
      {!map && (
        <div className="text-[12px] text-text-muted">
          No relationship data. Save the workflow to build the map.
        </div>
      )}

      {map && (
        <div className="space-y-4">
          <div className="flex gap-2 text-[12px]">
            <span className="count-badge">{map.resolvedCount} resolved</span>
            <span className="count-badge">{map.unresolvedCount} unresolved</span>
            <span className="count-badge">{map.unreferencedSubAgents.length} unreferenced</span>
          </div>

          {map.resolved.length > 0 && (
            <section>
              <div className="prop-section-title">Resolved</div>
              {map.resolved.map((entry) => (
                <div
                  key={`${entry.sourceNodeId}-${entry.childAgenticWorkflowId}`}
                  className="mb-1 flex items-center gap-2 rounded border border-success/40 bg-success/5 px-2 py-1.5 text-[12px]"
                >
                  <i className="bi-check-circle text-success" />
                  <span className="truncate">{entry.sourceNodeName || entry.sourceNodeId}</span>
                  <i className="bi-arrow-right text-text-muted" />
                  <span className="truncate font-medium">
                    {entry.childAgent?.displayName || entry.childAgent?.name}
                  </span>
                  <span className="ml-auto whitespace-nowrap text-text-muted">
                    {entry.childAgent?.nodeCount} nodes
                  </span>
                </div>
              ))}
            </section>
          )}

          {map.unresolved.length > 0 && (
            <section>
              <div className="prop-section-title">Unresolved</div>
              {map.unresolved.map((entry) => (
                <div
                  key={`${entry.sourceNodeId}-${entry.childAgenticWorkflowId}`}
                  className="mb-1 rounded border border-danger/40 bg-danger/5 px-2 py-1.5 text-[12px]"
                >
                  <div className="flex items-center gap-2">
                    <i className="bi-exclamation-triangle text-danger" />
                    <span>{entry.sourceNodeName || entry.sourceNodeId}</span>
                    <span className="ml-auto font-mono text-[10px] text-text-muted">
                      {entry.childAgenticWorkflowId}
                    </span>
                  </div>
                  {entry.validationMessage && (
                    <div className="mt-0.5 text-[11px] text-danger">{entry.validationMessage}</div>
                  )}
                </div>
              ))}
            </section>
          )}

          {map.unreferencedSubAgents.length > 0 && (
            <section>
              <div className="prop-section-title">Unreferenced Sub Agents</div>
              {map.unreferencedSubAgents.map((entry) => (
                <div
                  key={entry.agenticWorkflowId}
                  className="mb-1 rounded border border-warning/40 bg-warning/5 px-2 py-1.5 text-[12px] text-warning"
                >
                  {entry.displayName || entry.name}
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
