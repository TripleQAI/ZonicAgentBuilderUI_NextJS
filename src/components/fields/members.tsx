'use client';

import { FieldShell, type FieldProps } from '@/components/fields/primitives';
import { containerSpec, effectiveEntry, memberIds } from '@/lib/registry/containers';
import { nodeColor, nodeIcon } from '@/lib/registry/nodePresentation';
import { selectSelectedNode, useWorkflowStore } from '@/store/useWorkflowStore';

/**
 * `member_list` — a swarm's members. Like the handoff editor, it reads and
 * writes the store rather than the form: a member is a node on the canvas as
 * well as an ID in the list. Members join by being dropped onto the swarm on the
 * canvas; here they can be reviewed and taken out again (the node stays, outside
 * the swarm). The entry member is starred.
 */
export function MemberListField({ field }: FieldProps) {
  const swarm = useWorkflowStore(selectSelectedNode);
  const nodes = useWorkflowStore((s) => s.currentAgent?.nodes);
  const semantics = useWorkflowStore((s) => s.nodeSemantics);
  const getNodeTypeDef = useWorkflowStore((s) => s.getNodeTypeDef);
  const removeMember = useWorkflowStore((s) => s.removeMember);
  const isReadOnly = useWorkflowStore((s) => s.isReadOnly);

  const spec = swarm ? containerSpec(semantics, swarm.type) : undefined;
  if (!swarm || !spec) return null;
  const ids = memberIds(swarm, spec);
  const entry = effectiveEntry(swarm, spec);

  return (
    <FieldShell field={field}>
      {ids.length === 0 ? (
        <p className="text-[11px] text-text-muted">No members yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {ids.map((id) => {
            const member = nodes?.find((n) => n.id === id);
            const definition = member ? getNodeTypeDef(member.type) : undefined;
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-[12px]"
              >
                <i className={nodeIcon(definition)} style={{ color: nodeColor(definition) }} />
                <span className="min-w-0 flex-1 truncate text-text-primary">{member?.name ?? id}</span>
                {id === entry && (
                  <i className="bi-star-fill text-warning" role="img" aria-label="Entry member" title="Entry member" />
                )}
                {!isReadOnly && (
                  <button
                    type="button"
                    className="text-text-muted hover:text-danger"
                    aria-label={`Remove ${member?.name ?? id} from the swarm`}
                    title="Remove from the swarm"
                    onClick={() => removeMember(swarm.id, id)}
                  >
                    <i className="bi-x-lg" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </FieldShell>
  );
}
