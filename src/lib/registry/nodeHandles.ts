/**
 * Which connection handles a node actually renders.
 *
 * The registry's `handles` block describes the *static* case — one input, one
 * output. Three node types are dynamic, and their extra handles are the ones
 * stored edges attach to:
 *
 *   Rule   one output per configured branch (`config.rules[].ruleId`), so an
 *          edge with `sourceHandle: "r_elgn8m"` has something to land on. The
 *          registry only declares the two default branches, so a rule with five
 *          would silently drop three edges if handles came from it alone.
 *   Agent  one extra output per handoff target, `handoff-<targetNodeId>`.
 *
 * React Flow drops any edge whose handle id does not exist on the node — with
 * no error, the line simply never appears. That is what made connections go
 * missing.
 *
 * Which types behave this way is not hard-coded here: it comes from
 * `/api/v1/node-semantics`, the same declaration the backend reads.
 */

import { handoffPathFor } from '@/lib/registry/nodeFields';
import type { NodeSemantics } from '@/lib/registry/nodeSemantics';
import { getDotPath } from '@/lib/utils/dotPath';
import type { WorkflowEdge, WorkflowNode } from '@/types/agent';
import type { HandleDef, NodeTypeDef } from '@/types/registry';

export interface DerivedHandle {
  id: string;
  /** Shown next to the handle when a node has several outputs. */
  label?: string;
  kind: 'default' | 'branch' | 'handoff';
}

export interface DerivedHandles {
  targets: DerivedHandle[];
  sources: DerivedHandle[];
}

/** `handoff-<targetNodeId>` — the id the stored edges use. */
export const HANDOFF_PREFIX = 'handoff-';

export function deriveHandles(
  node: WorkflowNode,
  definition: NodeTypeDef | undefined,
  semantics: NodeSemantics,
  nodeNames: Record<string, string> = {},
  edges: WorkflowEdge[] = [],
): DerivedHandles {
  const declared = definition?.handles ?? {};
  const targets: DerivedHandle[] = (declared.targets ?? []).map((h: HandleDef) => ({
    id: h.id,
    label: h.label,
    kind: 'default' as const,
  }));

  // --- branch outputs (Rule) ------------------------------------------------
  const branchSpec = semantics.branches?.[node.type];
  let sources: DerivedHandle[];

  if (branchSpec) {
    const branches = (getDotPath(node, branchSpec.path) ?? []) as Record<string, unknown>[];
    const derived = Array.isArray(branches)
      ? branches
          .filter((b) => b && typeof b === 'object' && b[branchSpec.idField])
          .map((b) => ({
            id: String(b[branchSpec.idField]),
            label: String(b.label ?? b[branchSpec.idField]),
            kind: 'branch' as const,
          }))
      : [];
    // An unconfigured Rule still needs its declared defaults to be connectable.
    sources =
      derived.length > 0
        ? derived
        : (declared.sources ?? []).map((h: HandleDef) => ({
            id: h.id,
            label: h.label,
            kind: 'branch' as const,
          }));
  } else {
    sources = (declared.sources ?? []).map((h: HandleDef) => ({
      id: h.id,
      label: h.label,
      kind: 'default' as const,
    }));
  }

  // --- handoff outputs (Agent) ---------------------------------------------
  // The registry knows where the handoff list lives: it is the field its own
  // handoff editor is bound to. No extra declaration, and nothing to fetch.
  const handoffPath = handoffPathFor(definition) ?? semantics.handoffTargets?.[node.type];
  if (handoffPath) {
    const raw = getDotPath(node, handoffPath);
    const targetIds = (Array.isArray(raw) ? raw : raw ? [raw] : []) as string[];
    for (const targetId of targetIds.filter(Boolean)) {
      sources.push({
        id: `${HANDOFF_PREFIX}${targetId}`,
        label: nodeNames[targetId] ?? targetId,
        kind: 'handoff',
      });
    }
  }

  // --- whatever the stored edges already reference --------------------------
  // Last line of defence. React Flow drops an edge whose handle is missing, so
  // any handle an edge names must exist even if nothing above produced it —
  // a workflow saved by another tool, or a node type this build does not know.
  for (const edge of edges) {
    if (edge.source === node.id && edge.sourceHandle) {
      if (!sources.some((h) => h.id === edge.sourceHandle)) {
        sources.push({ id: edge.sourceHandle, kind: 'default' });
      }
    }
    if (edge.target === node.id && edge.targetHandle) {
      if (!targets.some((h) => h.id === edge.targetHandle)) {
        targets.push({ id: edge.targetHandle, kind: 'default' });
      }
    }
  }

  return { targets, sources };
}
